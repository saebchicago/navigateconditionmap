# Clinical review packet: Navigator by ConditionMap evidence pack

Prepared Oct 30, 2026 from `src/data/evidence-pack.json` (version 2026-10-29). Time needed: about 30 to 45 minutes per reviewer.

## Why you are being asked

Navigator helps family caregivers prepare up to three questions for a clinic visit about heart failure, type 2 diabetes, and chronic kidney disease. Every question and explanation shown to a caregiver is the exact text of one of the 12 cards below. An AI model only orders the cards; it writes no text a caregiver reads. The cards have not yet been reviewed by a clinician. Your review is what would change that, and only for what you actually check.

## What to check, for each card

1. **Source accuracy:** does the card say only what the cited source says? Is anything overstated, understated, or missing?
2. **Qualifications:** is any caveat dropped (population, eGFR or UACR thresholds, combinations that are not advised)?
3. **Eligibility:** is the card shown to the right people (conditions and medicines in the table)?
4. **Question:** is the question for the care team appropriate, neutral, and not advice?
5. **Wording for caregivers:** could a worried caregiver read it as an instruction to change a medicine?

For each card mark: Approve / Approve with edits / Do not use, and write the edit.

### E1: Kidney screening

- **Shown when:** conditions type_2_diabetes; no medicine required
- **Source:** Diabetes Management in Chronic Kidney Disease: A Consensus Report by the ADA and KDIGO (doi:10.2337/dci22-0027)
- **Card text shown to caregivers:** People with type 2 diabetes should be screened for CKD at least once a year, starting at diagnosis. Screening includes both a urine albumin test (UACR, which checks for protein in the urine) and eGFR (a blood test of how well the kidneys filter).
- **Question shown:** "When were the eGFR and urine albumin (UACR) last checked, and what were the results?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E2: SGLT2 inhibitor for kidney protection

- **Shown when:** conditions type_2_diabetes, ckd; no medicine required
- **Source:** Diabetes Management in Chronic Kidney Disease: A Consensus Report by the ADA and KDIGO (doi:10.2337/dci22-0027)
- **Card text shown to caregivers:** An SGLT2 inhibitor with proven kidney or heart benefit is recommended for people with type 2 diabetes and CKD when eGFR is at least 20. Once started, it can be continued, if tolerated, until dialysis begins.
- **Question shown:** "Is an SGLT2 inhibitor appropriate given the latest eGFR, and if one is already prescribed, should it continue?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E3: SGLT2 inhibitor in heart failure

- **Shown when:** conditions heart_failure; no medicine required
- **Source:** 2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure (doi:10.1002/ejhf.3024)
- **Card text shown to caregivers:** The 2023 ESC focused update recommends an SGLT2 inhibitor (dapagliflozin or empagliflozin) for heart failure with mildly reduced or preserved ejection fraction, to lower the risk of a heart failure hospital stay or heart-related death. This is the guideline's strongest recommendation.
- **Question shown:** "Given the heart failure type and ejection fraction, would an SGLT2 inhibitor lower the risk of hospitalization?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E4: Metformin and kidney function

- **Shown when:** conditions type_2_diabetes, ckd; medicines (any of): metformin
- **Source:** Diabetes Management in Chronic Kidney Disease: A Consensus Report by the ADA and KDIGO (doi:10.2337/dci22-0027)
- **Card text shown to caregivers:** Metformin is recommended in type 2 diabetes with CKD when eGFR is at least 30. A lower dose is usually needed when eGFR is 30 to 44.
- **Question shown:** "Does the current metformin dose still fit the latest eGFR?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E5: ACE inhibitor or ARB with albuminuria

- **Shown when:** conditions type_2_diabetes, ckd; no medicine required
- **Source:** Diabetes Management in Chronic Kidney Disease: A Consensus Report by the ADA and KDIGO (doi:10.2337/dci22-0027)
- **Card text shown to caregivers:** An ACE inhibitor or ARB is recommended for people with diabetes who have high blood pressure and albuminuria (protein in the urine), slowly raised to the highest dose the person tolerates. Combining an ACE inhibitor with an ARB is not advised because of high potassium and acute kidney injury risk.
- **Question shown:** "Is there albuminuria, and is the blood pressure medicine an ACE inhibitor or ARB at the highest tolerated dose?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E6: Finerenone

- **Shown when:** conditions type_2_diabetes, ckd; no medicine required
- **Source:** Diabetes Management in Chronic Kidney Disease: A Consensus Report by the ADA and KDIGO (doi:10.2337/dci22-0027)
- **Card text shown to caregivers:** Finerenone (a nonsteroidal MRA) is recommended for people with type 2 diabetes, eGFR of at least 25, normal potassium, and albuminuria (ACR of 30 mg/g or more) despite the maximum tolerated dose of an ACE inhibitor or ARB.
- **Question shown:** "If albuminuria persists on an ACE inhibitor or ARB, is finerenone an option, and what do the potassium levels show?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E7: GLP-1 receptor agonist

- **Shown when:** conditions type_2_diabetes, ckd; no medicine required
- **Source:** 11. Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes-2026 (doi:10.2337/dc26-S011)
- **Card text shown to caregivers:** ADA's 2026 Standards of Care recommend a GLP-1 receptor agonist with proven benefit for people with type 2 diabetes and CKD, to slow kidney disease and lower heart risk. A large trial (FLOW, NEJM 2024), in people with type 2 diabetes and CKD, found that semaglutide lowered the risk of a combined outcome by 24% compared with placebo. The combined outcome was kidney failure, a large drop in kidney function, or death from kidney or heart causes.
- **Question shown:** "Would a GLP-1 receptor agonist with proven kidney and heart benefit fit this person's care plan?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E8: Blood pressure target

- **Shown when:** conditions type_2_diabetes; no medicine required
- **Source:** 10. Cardiovascular Disease and Risk Management: Standards of Care in Diabetes-2026 (doi:10.2337/dc26-S010)
- **Card text shown to caregivers:** ADA's 2026 Standards of Care say that for people with diabetes and high blood pressure, the goal is below 130/80 if it can be reached safely. For people at high risk of heart or kidney disease, ADA encourages a top number (systolic) below 120. Goals should be set together with the care team.
- **Question shown:** "What is the blood pressure target for this person, and are home readings meeting it?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E9: SGLT2 inhibitor in reduced ejection fraction

- **Shown when:** conditions heart_failure; no medicine required
- **Source:** 2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure (doi:10.1161/CIR.0000000000001063)
- **Card text shown to caregivers:** The 2022 AHA/ACC/HFSA guideline strongly recommends SGLT2 inhibitors for people with symptoms of heart failure with reduced ejection fraction, to reduce hospital stays and heart-related death, whether or not the person has type 2 diabetes.
- **Question shown:** "If the ejection fraction is reduced, is an SGLT2 inhibitor part of the heart failure treatment plan?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E10: Nonsteroidal MRA in heart failure with ejection fraction above 40%

- **Shown when:** conditions heart_failure, type_2_diabetes; no medicine required
- **Source:** 10. Cardiovascular Disease and Risk Management: Standards of Care in Diabetes-2026 (doi:10.2337/dc26-S010)
- **Card text shown to caregivers:** ADA's 2026 Standards of Care recommend a nonsteroidal MRA with proven benefit (such as finerenone) for people with diabetes who have heart failure symptoms and an ejection fraction above 40%, to lower the risk of heart failure getting worse. ADA says it should not be used together with another MRA.
- **Question shown:** "Given the ejection fraction and current heart failure medicines, is a nonsteroidal MRA an option, and what do the potassium and kidney tests show?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E11: SGLT2 inhibitor to prevent heart failure

- **Shown when:** conditions type_2_diabetes, ckd; no medicine required
- **Source:** 2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure (doi:10.1002/ejhf.3024)
- **Card text shown to caregivers:** The 2023 ESC focused update recommends an SGLT2 inhibitor (dapagliflozin or empagliflozin) for people with type 2 diabetes and CKD, to lower the risk of a heart failure hospital stay or heart-related death. This is the guideline's strongest recommendation.
- **Question shown:** "Does the current plan include a medicine that lowers heart failure risk given both diabetes and CKD?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

### E12: SGLT2 inhibitor and finerenone together

- **Shown when:** conditions type_2_diabetes, ckd; no medicine required
- **Source:** 11. Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes-2026 (doi:10.2337/dc26-S011)
- **Card text shown to caregivers:** ADA's 2026 Standards of Care say starting an SGLT2 inhibitor and finerenone at the same time can be considered for adults with type 2 diabetes who take a medicine that blocks the renin-angiotensin system (such as an ACE inhibitor or ARB), have a urine albumin (UACR) of 100 or more, and have an eGFR of 30 to 90. A 6-month study (CONFIDENCE, NEJM 2025) found that starting both together lowered urine albumin more than either drug alone, with no unexpected safety problems. It did not measure kidney failure or other long-term outcomes.
- **Question shown:** "Do the latest UACR and eGFR results fit the range where these two medicines can be considered together?"
- **Reviewer decision:** [ ] Approve [ ] Approve with edits [ ] Do not use
- **Source accuracy / qualifications / eligibility / question notes:**

  ***

## Rules to review across cards

- **Heart failure type:** if the type is known, E9 is dropped for mildly reduced or preserved ejection fraction, and E3 and E10 are dropped for reduced ejection fraction. Is that right for each card's source wording?
- **Medicine triggers:** E4 (metformin) shows only if a current medicine matches metformin or a brand containing it. Entries that say stopped, no, never, allergic, used to, and similar are not counted as current.
- **One card per medicine class:** SGLT2 inhibitor cards (E2, E3, E9, E11, E12) and nonsteroidal MRA cards (E6, E10) are grouped, so only one per group is in the first three questions; others are available through "Add another question".
- **Notes under cards:** cards that name an eGFR level or mention potassium show a fixed note asking the caregiver to bring the latest result and ask the care team. The app does not compare the caregiver's numbers with the card. Is that note appropriate?
- **Kidney-only gap:** every kidney card requires type 2 diabetes, so kidney disease alone returns no cards. Should a separate reviewed kidney-only pack be built?
- **Fixed prompts outside the cards:** "Before you go" (bring all medicine bottles and results; cost questions) and "After the visit" (what the care team said, who does what by when, what to explain, say the plan back). Any concerns?
- **Disclaimers:** emergency banner, "not medical advice", "does not check symptoms or decide which treatment is right". Adequate?

## Overall

- Biggest risk you see in the cards or rules: ______________________________
- Cards or topics missing that most caregivers would need: ______________________________

## Reviewer sign-off (state only what you actually did)

- Name or role (for example, board-certified cardiologist, nephrologist, endocrinologist, clinical pharmacist): ______________
- Cards reviewed: [ ] all 12 [ ] only: ______
- Sources checked against: [ ] full guideline text [ ] abstract or summary only
- Date: ______
- May Navigator publish your name or role as a reviewer? [ ] Yes [ ] Role only [ ] No
- Conflicts of interest or compensation to disclose: ______________

Your sign-off will be quoted exactly as written. It is not an endorsement of the product and not clinical validation.
