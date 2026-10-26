import { SubmitButton } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n";
import type { AttachmentRow } from "@/lib/files/data";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, formatBytes, type AttachmentKind } from "@/lib/files/rules";
import { removeAttachment, uploadAttachment } from "@/app/files/actions";

interface Props {
  kind: AttachmentKind;
  refId: string;
  athleteId?: string | null;
  /** Page to come back to after uploading or removing (path with query). */
  back: string;
  files: AttachmentRow[];
  canUpload: boolean;
  /** The signed-in user, who may remove their own files. */
  userId: string;
  t: Dictionary;
  title?: string;
}

/** Files attached to one record: a download list and, when allowed, an upload form. Server component. */
export function AttachmentsPanel({ kind, refId, athleteId, back, files, canUpload, userId, t, title }: Props) {
  const tf = t.files;
  if (files.length === 0 && !canUpload) return null;
  return (
    <section aria-label={title ?? tf.title} data-testid={`files-${kind}`} className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title ?? tf.title}</h4>
      {files.length === 0 ? <p className="text-sm text-muted">{tf.empty}</p> : (
        <ul className="divide-y divide-line text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-1.5">
              <a href={`/files/${f.id}`} className="min-w-0 truncate font-medium text-brand-700 hover:underline" download><bdi>{f.file_name}</bdi></a>
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                <span className="num">{formatBytes(f.size_bytes)}</span>
                {f.uploaded_by === userId && (
                  <form action={removeAttachment}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="back" value={back} />
                    <button type="submit" className="text-red-700 hover:underline" aria-label={`${tf.remove}: ${f.file_name}`}>{tf.remove}</button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <form action={uploadAttachment} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="ref_id" value={refId} />
          {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
          <input type="hidden" name="back" value={back} />
          <input
            type="file"
            name="file"
            required
            aria-label={tf.choose}
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
            className="block min-w-0 flex-1 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
          <SubmitButton variant="secondary">{tf.upload}</SubmitButton>
        </form>
      )}
      {canUpload && <p className="text-xs text-muted">{tf.limits.replace("{size}", formatBytes(MAX_FILE_BYTES))}</p>}
    </section>
  );
}
