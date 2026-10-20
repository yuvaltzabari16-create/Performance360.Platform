"""Generates supabase/migrations/20261020195707_reference_data.sql from the tables below.
Content is original, plain-language exercise and test descriptions. No videos
are bundled, and the tests carry no normative values."""
import pathlib

def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "array[" + ", ".join(q(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"

# name, category, objective, pattern, muscles, equipment, difficulty, description, cues, errors, regression, progression, prescription
EX = [
 ("Back Squat","strength","Lower-body maximal strength","Squat",["quadriceps","glutes","adductors"],["barbell","rack"],"intermediate","Barbell on upper back; descend by bending hips and knees together, then stand back up.",["Brace before each rep","Knees track over toes","Drive the floor away"],["Heels lifting","Losing trunk position at the bottom"],"Goblet squat","Pause back squat","3-5 x 3-6 @ 75-87% 1RM, 2-4 min rest"),
 ("Front Squat","strength","Lower-body strength with upright trunk","Squat",["quadriceps","glutes","upper back"],["barbell","rack"],"intermediate","Bar racked on the front of the shoulders; squat with an upright torso.",["Elbows high","Stay tall through the descent"],["Elbows dropping","Rounding upper back"],"Goblet squat","Pause front squat","3-5 x 3-5, 2-3 min rest"),
 ("Goblet Squat","strength","Squat pattern and positional strength","Squat",["quadriceps","glutes"],["dumbbell","kettlebell"],"beginner","Hold a weight at the chest and squat between the knees.",["Chest tall","Sit between the heels"],["Collapsing knees"],"Box squat to bench","Front squat","3 x 8-10"),
 ("Trap Bar Deadlift","strength","Lower-body strength","Hinge",["glutes","hamstrings","quadriceps"],["trap bar"],"beginner","Stand inside a hex bar and lift it by extending hips and knees.",["Push the floor away","Neutral spine"],["Hips rising first","Rounded back"],"Kettlebell deadlift","Conventional deadlift","3-5 x 3-6"),
 ("Romanian Deadlift","strength","Posterior chain strength","Hinge",["hamstrings","glutes"],["barbell","dumbbells"],"intermediate","From standing, push hips back with soft knees until hamstrings are loaded, then return.",["Hips back, not down","Bar close to legs"],["Rounding lower back","Squatting the movement"],"Kettlebell RDL","Single-leg RDL","3 x 6-10"),
 ("Bulgarian Split Squat","strength","Unilateral lower-body strength","Single-leg squat",["quadriceps","glutes"],["bench","dumbbells"],"intermediate","Rear foot elevated on a bench; lower the back knee toward the floor.",["Front foot flat","Control the descent"],["Front knee caving"],"Split squat","Loaded rear-foot-elevated split squat","3 x 6-10 each side"),
 ("Hip Thrust","strength","Hip extension strength","Hip extension",["glutes","hamstrings"],["barbell","bench"],"beginner","Upper back on a bench, drive the hips up until the torso is level.",["Ribs down","Pause at the top"],["Arching the lower back"],"Glute bridge","Single-leg hip thrust","3 x 8-12"),
 ("Nordic Hamstring Curl","strength","Eccentric hamstring strength","Knee flexion",["hamstrings"],["partner or anchor"],"advanced","Kneel with ankles anchored and lower the body forward as slowly as possible.",["Hips extended","Resist the whole way"],["Breaking at the hips"],"Band-assisted Nordic","Slower eccentric tempo","2-3 x 3-6"),
 ("Bench Press","strength","Upper-body pushing strength","Horizontal push",["pectorals","triceps","anterior deltoid"],["barbell","bench"],"intermediate","Lower the bar to the chest and press it back to straight arms.",["Shoulder blades set","Feet planted"],["Bouncing off the chest","Elbows flaring"],"Push-up","Paused bench press","3-5 x 3-8"),
 ("Pull-Up","strength","Upper-body pulling strength","Vertical pull",["latissimus dorsi","biceps"],["pull-up bar"],"intermediate","Hang from a bar and pull until the chin clears it.",["Full hang to start","Chest to bar"],["Kipping","Partial range"],"Band-assisted pull-up","Weighted pull-up","3-4 x 4-10"),
 ("Single-Arm Dumbbell Row","strength","Horizontal pulling strength","Horizontal pull",["latissimus dorsi","rhomboids"],["dumbbell","bench"],"beginner","Support on a bench and row a dumbbell toward the hip.",["Pull the elbow to the hip","Square shoulders"],["Twisting the trunk"],"Band row","Heavier load","3 x 8-12 each side"),
 ("Copenhagen Plank","stability","Adductor strength","Side plank",["adductors","obliques"],["bench"],"intermediate","Side plank with the top leg supported on a bench.",["Straight line head to foot"],["Hips sagging"],"Short-lever Copenhagen","Add leg raise","2-3 x 15-30 s each side"),
 ("Hang Power Clean","olympic","Triple-extension power","Olympic derivative",["glutes","quadriceps","trapezius"],["barbell"],"advanced","From hang position, extend explosively and receive the bar in a quarter squat.",["Bar close","Fast elbows"],["Arm pulling early"],"Clean pull from hang","Power clean from floor","3-5 x 2-3"),
 ("Clean Pull","olympic","Force production in triple extension","Olympic derivative",["glutes","hamstrings","trapezius"],["barbell"],"intermediate","Pull from the floor and finish with full hip and knee extension without catching.",["Push through the floor","Finish tall"],["Bending arms early"],"Hang high pull","Heavier pull","3-4 x 3"),
 ("Jump Squat","power","Lower-body power","Jump",["quadriceps","glutes"],["bodyweight","barbell"],"intermediate","Light-load or bodyweight squat followed by a maximal jump.",["Quick dip","Land softly"],["Stiff landing"],"Countermovement jump","Loaded jump squat","3-5 x 3-5"),
 ("Medicine Ball Rotational Throw","power","Rotational power","Rotation",["obliques","hips"],["medicine ball","wall"],"beginner","Rotate from the hips and throw the ball into a wall.",["Load the back hip","Release fast"],["Throwing only with arms"],"Half-kneeling throw","Step-behind throw","3-4 x 4-6 each side"),
 ("Box Jump","plyometrics","Concentric jump power","Jump",["quadriceps","glutes","calves"],["plyo box"],"beginner","Jump onto a box and land softly; step down.",["Arms drive","Land quietly"],["Box too high","Jumping down"],"Countermovement jump","Single-leg box jump","3-5 x 3-5"),
 ("Pogo Jumps","plyometrics","Ankle stiffness and reactive strength","Hop",["calves"],["bodyweight"],"beginner","Small rapid bilateral hops using mainly the ankles.",["Short ground contact","Stay tall"],["Heels touching down"],"Low-amplitude pogos","Single-leg pogos","3 x 10-20 contacts"),
 ("Drop Jump","plyometrics","Reactive strength","Depth jump",["calves","quadriceps"],["plyo box"],"advanced","Step off a box, contact the ground briefly and jump as high as possible.",["Minimal ground time","Step off, don't jump off"],["Long, deep contact"],"Pogo jumps","Increase box height","3 x 3-5"),
 ("Bounding","plyometrics","Horizontal elastic power","Bound",["glutes","hamstrings","calves"],["field"],"intermediate","Exaggerated running strides covering maximum distance per contact.",["Drive the knee","Active foot strike"],["Overstriding"],"Skips for distance","Single-leg bounds","3-4 x 20-30 m"),
 ("Lateral Hop and Stick","plyometrics","Frontal-plane landing control","Hop",["glutes","adductors"],["bodyweight"],"beginner","Hop sideways on one leg and hold the landing for two seconds.",["Knee over toes","Quiet landing"],["Knee caving"],"Bilateral lateral jump","Continuous lateral hops","3 x 5 each side"),
 ("Wall Drill March","acceleration","Acceleration posture","Sprint drill",["hip flexors","glutes"],["wall"],"beginner","Lean into a wall at an acceleration angle and drive knees alternately.",["Straight line ankle to head","Dorsiflexed foot"],["Bending at the waist"],"Wall hold","Wall drill exchanges","3 x 10 each leg"),
 ("10 m Acceleration Sprint","acceleration","Acceleration","Sprint",["full body"],["field","cones"],"beginner","Maximal effort sprint over 10 m from a static start.",["Push the ground back","Gradual rise"],["Popping up too early"],"Falling start","Sled-resisted sprint","4-6 x 10 m, full recovery"),
 ("Resisted Sled Sprint","acceleration","Horizontal force production","Sprint",["glutes","quadriceps"],["sled"],"intermediate","Sprint while towing a sled with a load that preserves sprint mechanics.",["Forward lean","Powerful pushes"],["Load so heavy that mechanics break"],"Sled march","Heavier sled","4-6 x 10-20 m"),
 ("Flying 20 m Sprint","max_velocity","Maximum velocity","Sprint",["hamstrings","hip flexors"],["field","cones"],"intermediate","Build up over 20-30 m, then sprint maximally through a 20 m zone.",["Tall posture","Front-side mechanics"],["Overstriding","Tension in the face/shoulders"],"Build-up runs","Longer flying zone","3-5 reps, 3-5 min rest"),
 ("A-Skip","sprint","Sprint mechanics","Sprint drill",["hip flexors","calves"],["field"],"beginner","Rhythmic skip with high knee drive and active foot strike.",["Tall hips","Strike under the hip"],["Leaning back"],"A-march","B-skip","2-3 x 20 m"),
 ("Deceleration Drill (Run to Stop)","deceleration","Braking mechanics","Deceleration",["quadriceps","glutes"],["field","cones"],"intermediate","Accelerate for 10 m then stop within 3 steps.",["Lower center of mass","Short braking steps"],["Upright stop","Knee valgus"],"Jog to stop","Faster entry speed","4-6 reps"),
 ("505 Drill","cod","180-degree change of direction","Change of direction",["quadriceps","glutes","adductors"],["cones"],"intermediate","Sprint 5 m beyond a line, plant and turn 180 degrees, sprint back through.",["Lower before the turn","Push out of the cut"],["Rounding the turn"],"Shuffle and turn","Reactive cue","4-6 reps each side"),
 ("Shuffle to Sprint","cod","Lateral transition","Change of direction",["adductors","glutes"],["cones"],"beginner","Lateral shuffle for 3-5 m, then open the hips and sprint forward.",["Stay low","Quick hip turn"],["Crossing feet"],"Shuffle only","Reactive shuffle","4-6 reps each side"),
 ("Tempo Runs","conditioning","Aerobic capacity","Running",["full body"],["field"],"beginner","Runs at a moderate, controlled pace with walking recovery.",["Relaxed rhythm"],["Running too fast"],"Shorter reps","More reps","6-12 x 100 m @ ~70% effort, walk back"),
 ("Repeated Sprint Intervals","conditioning","Repeated high-intensity ability","Running",["full body"],["field"],"advanced","Short maximal sprints with incomplete recovery.",["Maintain quality"],["Pacing the early reps"],"Longer recovery","Shorter recovery","2-3 sets x 6 x 20-30 m"),
 ("Air Bike Intervals","conditioning","Metabolic conditioning","Cycling",["full body"],["air bike"],"beginner","Alternating hard and easy intervals on an air bike.",["Drive with legs and arms"],["Starting too hard"],"Longer rest","Shorter rest","8-10 x 20 s hard / 40 s easy"),
 ("World's Greatest Stretch","mobility","Multi-joint mobility","Lunge",["hip flexors","thoracic spine"],["bodyweight"],"beginner","Lunge, elbow to instep, then rotate the arm to the ceiling.",["Long back leg","Follow the hand with the eyes"],["Rushing"],"Half-kneeling hip flexor stretch","Add hamstring rock-back","1-2 x 5 each side"),
 ("90/90 Hip Switches","mobility","Hip rotation mobility","Hip rotation",["hip rotators"],["floor"],"beginner","Sitting with both legs at 90 degrees, rotate the knees side to side.",["Sit tall"],["Using hands to cheat"],"Hands supported","Lift-offs","2 x 8 each side"),
 ("Ankle Dorsiflexion Rock","mobility","Ankle mobility","Ankle",["calves"],["wall"],"beginner","Half-kneeling, drive the front knee over the toes keeping the heel down.",["Heel stays down"],["Foot collapsing inward"],"Smaller range","Add load","2 x 10 each side"),
 ("Dead Bug","core","Anti-extension control","Anti-extension",["abdominals"],["floor"],"beginner","On the back, extend opposite arm and leg while keeping the low back down.",["Exhale fully","Slow"],["Lower back arching"],"Heel taps","Banded dead bug","2-3 x 6-10 each side"),
 ("Pallof Press","core","Anti-rotation control","Anti-rotation",["obliques"],["band","cable"],"beginner","Press a band straight out from the chest without letting the trunk rotate.",["Ribs stacked over pelvis"],["Rotating toward anchor"],"Half-kneeling Pallof","Pallof with step-out","3 x 8-10 each side"),
 ("Side Plank","core","Lateral trunk endurance","Anti-lateral flexion",["obliques"],["floor"],"beginner","Support on one forearm with a straight body line.",["Push the floor away"],["Hips dropping"],"Knees bent","Top leg raise","2-3 x 20-40 s each side"),
 ("Single-Leg Balance Reach","stability","Single-leg control","Balance",["glutes","foot muscles"],["bodyweight"],"beginner","Balance on one leg and reach the free foot in several directions.",["Soft knee","Steady pelvis"],["Hip hiking"],"Hand support","Eyes closed / unstable surface","2 x 5 reaches each direction"),
 ("Dynamic Warm-up Flow","warmup","General preparation","Mixed",["full body"],["field"],"beginner","Progressive sequence of jogging, skips, lunges and leg swings.",["Gradually increase intensity"],["Static, rushed warm-up"],"Shorter flow","Add sprint build-ups","8-12 min"),
 ("Glute Bridge Activation","warmup","Hip extension activation","Hip extension",["glutes"],["floor","mini band"],"beginner","Bridge the hips up and hold briefly.",["Squeeze glutes at top"],["Arching lower back"],"Short hold","Single-leg bridge","2 x 10"),
 ("Foam Rolling","recovery","Recovery and comfort","Soft tissue",["full body"],["foam roller"],"beginner","Slow rolling over major muscle groups.",["Breathe and move slowly"],["Rolling directly on painful joints"],None,None,"30-60 s per area"),
 ("Low-Intensity Bike Flush","recovery","Active recovery","Cycling",["full body"],["bike"],"beginner","Easy continuous cycling at conversational intensity.",["Easy effort"],["Going too hard"],None,None,"10-20 min easy"),
 ("Isometric Spanish Squat","rehab","Isometric quadriceps loading","Squat",["quadriceps"],["band","anchor"],"beginner","With a band behind the knees, sit back into a squat hold. Use under guidance of the responsible professional.",["Shins vertical","Even weight"],["Holding breath"],"Shallower angle","Longer holds","4-5 x 30-45 s"),
 ("Calf Raise (Straight Knee)","rehab","Calf capacity","Plantarflexion",["gastrocnemius"],["step"],"beginner","Rise onto the toes and lower slowly with a straight knee.",["Full range","Slow lowering"],["Bouncing"],"Bilateral","Single-leg / loaded","3 x 12-20"),
]

TESTS = [
 ("Countermovement Jump","CMJ","jump","cm",True,False,"Hands on hips, rapid dip and maximal vertical jump. Record jump height. Note the device used (e.g. force plate, contact mat, app) because methods are not interchangeable.",3),
 ("Squat Jump","SJ","jump","cm",True,False,"Hold a static squat (~90° knee angle) for 2-3 s, then jump without countermovement. Hands on hips.",3),
 ("Single-Leg Countermovement Jump","SL CMJ","jump","cm",True,True,"Countermovement jump on one leg, hands on hips. Test each side.",3),
 ("Drop Jump (RSI)","DJ RSI","jump","ratio",True,False,"Drop from a standardised box height, minimise contact time and jump maximally. Record reactive strength index (jump height / contact time) and note the box height.",3),
 ("Drop Jump Height","DJ","jump","cm",True,False,"Drop jump from a standardised box height; record jump height and note the box height.",3),
 ("Repeated Jump Test (10/5)","10/5 RJT","jump","ratio",True,False,"Continuous maximal hops; record the mean RSI of the best 5 of 10 jumps.",1),
 ("5 m Sprint","5 m","speed","s",False,False,"Sprint from a standardised start. Record start method (e.g. 0.5 m behind first gate) and timing system.",3),
 ("10 m Sprint","10 m","speed","s",False,False,"Sprint from a standardised start. Record start method and timing system.",3),
 ("20 m Sprint","20 m","speed","s",False,False,"Sprint from a standardised start. Record start method and timing system.",3),
 ("30 m Sprint","30 m","speed","s",False,False,"Sprint from a standardised start. Record start method and timing system.",3),
 ("Flying 10 m Sprint","Flying 10","speed","s",False,False,"Time a 10 m zone after a standardised build-up distance (record it).",3),
 ("505 Change of Direction","505","cod","s",False,True,"Sprint 10 m to a line, then 5 m beyond, turn 180° and sprint back through the timing gate. Test both turning sides.",3),
 ("5-10-5 Shuttle (Pro Agility)","5-10-5","cod","s",False,False,"Start in the middle, sprint 5 yd to one side, 10 yd to the other, and 5 yd back through the start.",2),
 ("Yo-Yo Intermittent Recovery Test Level 1","Yo-Yo IR1","endurance","m",True,False,"Audio-paced 2 x 20 m shuttles with 10 s active recovery. Record total distance.",1),
 ("Yo-Yo Intermittent Recovery Test Level 2","Yo-Yo IR2","endurance","m",True,False,"Higher starting speed version of the Yo-Yo IR test. Record total distance.",1),
 ("Estimated 1RM (repetition test)","e1RM","strength","kg",True,False,"Record the load lifted for a submaximal repetition test; note the exercise and estimation equation in the method field.",1),
 ("Single-Leg Squat to Box (reps)","SL squat reps","strength","reps",True,True,"Maximum controlled single-leg squats to a standardised box height. Test each side.",1),
 ("Weight-Bearing Lunge Test","WBLT","mobility","cm",True,True,"Knee-to-wall lunge; record the maximum toe-to-wall distance with the heel down.",3),
 ("Isometric Mid-Thigh Pull","IMTP","strength","N",True,False,"Requires a force plate. Record peak force and note the device and analysis settings.",3),
]

out = ["-- Reference data: system exercise library and test definitions (generated by scripts/gen-reference-sql.py)."]
for e in EX:
    (name, cat, obj, pat, mus, eq, diff, desc, cues, errs, reg, prog, pres) = e
    out.append(
        "insert into public.exercises (owner_id, name, category, primary_objective, movement_pattern, primary_muscles, equipment, difficulty, description, coaching_cues, common_errors, regressions, progressions, suggested_prescription, source) values ("
        + ", ".join([ "null", q(name), q(cat), q(obj), q(pat), q(mus), q(eq), q(diff), q(desc), q(cues), q(errs), q(reg), q(prog), q(pres), q("Performance360 system library") ]) + ");")
for t in TESTS:
    (name, short, cat, unit, hib, bil, proto, trials) = t
    out.append(
        "insert into public.test_definitions (owner_id, name, short_name, category, unit, higher_is_better, bilateral, protocol, default_trials) values ("
        + ", ".join(["null", q(name), q(short), q(cat), q(unit), q(hib), q(bil), q(proto), q(trials)]) + ");")
root = pathlib.Path(__file__).resolve().parent.parent
(root / "supabase/migrations/20261020195707_reference_data.sql").write_text("\n".join(out) + "\n")
print(len(EX), "exercises,", len(TESTS), "tests")
