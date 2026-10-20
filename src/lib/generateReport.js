import { jsPDF } from 'jspdf';
import { base44 } from '@/api/base44Client';

const PRIMARY = [43, 127, 224];
const DARK = [30, 41, 59];
const MUTED = [100, 116, 139];

function sectionTitle(doc, text, x, y) {
  doc.setFillColor(...PRIMARY);
  doc.rect(x, y - 10, 3, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(text, x + 8, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(x, y + 6, x + 515, y + 6);
  return y + 22;
}

function ensureSpace(doc, y, needed = 40) {
  if (y + needed > 800) { doc.addPage(); return 40; }
  return y;
}

export async function generateAthleteReport(athleteId, athleteName = 'Athlete') {
  const [perf, milestones, movement] = await Promise.all([
    base44.entities.PerformanceMetric.filter({ user_id: athleteId }, { sort: '-date', limit: 200 }),
    base44.entities.ClearanceMilestone.filter({ user_id: athleteId }, { sort: 'order', limit: 50 }),
    base44.entities.MovementAnalysis.filter({ user_id: athleteId, status: 'completed' }, { sort: '-created_date', limit: 10 }),
  ]);
  const metrics = perf.items || [];
  const ms = milestones.items || [];
  const moves = movement.items || [];

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // Header band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Athlete Performance Report', M, 38);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(athleteName, M, 56);
  doc.text(new Date().toLocaleDateString(), W - M, 56, { align: 'right' });

  let y = 100;

  // Summary line
  doc.setTextColor(...MUTED); doc.setFontSize(9);
  const completedMs = ms.filter((m) => m.status === 'completed').length;
  doc.text(`Performance tests: ${metrics.length}   |   Rehab milestones: ${completedMs}/${ms.length} completed   |   Movement analyses: ${moves.length}`, M, y);
  y += 24;

  // Performance Metrics — latest per test
  y = sectionTitle(doc, 'Performance Metrics (Latest Results)', M, y);
  const latestPerTest = {};
  metrics.forEach((m) => { if (!latestPerTest[m.test_name] || m.date > latestPerTest[m.test_name].date) latestPerTest[m.test_name] = m; });
  const testRows = Object.values(latestPerTest);
  if (testRows.length === 0) {
    doc.setTextColor(...MUTED); doc.setFontSize(10); doc.setFont('helvetica', 'italic');
    doc.text('No performance metrics recorded.', M, y); y += 18;
  } else {
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('Test', M, y); doc.text('Category', M + 180, y); doc.text('Value', M + 320, y); doc.text('Date', M + 400, y);
    y += 6; doc.setDrawColor(226, 232, 240); doc.line(M, y, M + 515, y); y += 12;
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'normal');
    testRows.forEach((r) => {
      y = ensureSpace(doc, y);
      doc.text(String(r.test_name).slice(0, 30), M, y);
      doc.text(r.category, M + 180, y);
      doc.text(`${r.value} ${r.unit || ''}`, M + 320, y);
      doc.text(r.date, M + 400, y);
      y += 16;
    });
  }
  y += 16;

  // Rehab Milestones
  y = ensureSpace(doc, y, 60);
  y = sectionTitle(doc, 'Rehab Milestone Progress', M, y);
  if (ms.length === 0) {
    doc.setTextColor(...MUTED); doc.setFontSize(10); doc.setFont('helvetica', 'italic');
    doc.text('No rehab milestones recorded.', M, y); y += 18;
  } else {
    ms.forEach((m) => {
      y = ensureSpace(doc, y, 30);
      const color = m.status === 'completed' ? [16, 185, 129] : m.status === 'in_progress' ? PRIMARY : [148, 163, 184];
      doc.setFillColor(...color);
      doc.circle(M + 4, y - 3, 3, 'F');
      doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`${m.order ?? '•'}. ${m.title}`, M + 14, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(m.status.replace('_', ' '), M + 400, y, { align: 'left' });
      y += 13;
      if (m.description) { doc.text(String(m.description).slice(0, 90), M + 14, y); y += 12; }
      y += 6;
    });
  }
  y += 16;

  // Movement Analysis
  y = ensureSpace(doc, y, 60);
  y = sectionTitle(doc, 'Recent Movement Analysis', M, y);
  if (moves.length === 0) {
    doc.setTextColor(...MUTED); doc.setFontSize(10); doc.setFont('helvetica', 'italic');
    doc.text('No completed movement analyses.', M, y); y += 18;
  } else {
    moves.forEach((mv) => {
      y = ensureSpace(doc, y, 40);
      doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(mv.movement_type || 'Movement Analysis', M, y);
      doc.setTextColor(...PRIMARY); doc.text(`Score: ${mv.score ?? '—'}/100`, M + 400, y);
      y += 13;
      if (mv.ai_feedback) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
        const lines = doc.splitTextToSize(String(mv.ai_feedback), 480);
        lines.slice(0, 3).forEach((l) => { y = ensureSpace(doc, y); doc.text(l, M, y); y += 12; });
      }
      y += 6;
    });
  }

  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`ApexMotion · Generated ${new Date().toLocaleString()}`, M, 820);
    doc.text(`${i}/${pages}`, W - M, 820, { align: 'right' });
  }

  doc.save(`ApexMotion-Report-${athleteName.replace(/\s+/g, '-')}.pdf`);
}