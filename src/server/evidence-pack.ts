// Embedded copy of src/data/evidence-pack.json for the server. Keep identical.
export const EVIDENCE_PACK = {
  version: "2026-10-29",
  scope: ["heart_failure", "type_2_diabetes", "ckd"],
  label_definitions: {
    Verified:
      "Paraphrased from a published guideline or consensus report and checked against it, cited with DOI.",
  },
  sources: {
    ADA_KDIGO_2022: {
      title:
        "Diabetes Management in Chronic Kidney Disease: A Consensus Report by the ADA and KDIGO",
      authors: "de Boer IH, et al.",
      journal: "Diabetes Care 2022;45(12):3075-3090 (also Kidney Int 2022;102(5):974-989)",
      doi: "10.2337/dci22-0027",
    },
    ESC_HF_2023: {
      title:
        "2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure",
      authors: "McDonagh TA, Metra M, et al.",
      journal:
        "Eur J Heart Fail 2024;26(1):5-17 (also Eur Heart J 2023;44(37):3627-3639, doi 10.1093/eurheartj/ehad195)",
      doi: "10.1002/ejhf.3024",
    },
    AHA_HF_2022: {
      title: "2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure",
      authors: "Heidenreich PA, Bozkurt B, et al.",
      journal: "Circulation 2022;145(18):e895-e1032",
      doi: "10.1161/CIR.0000000000001063",
    },
    ADA_CVD_2026: {
      title: "10. Cardiovascular Disease and Risk Management: Standards of Care in Diabetes-2026",
      authors: "American Diabetes Association Professional Practice Committee for Diabetes",
      journal: "Diabetes Care 2026;49(Suppl 1):S216-S245",
      doi: "10.2337/dc26-S010",
    },
    ADA_CKD_2026: {
      title: "11. Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes-2026",
      authors: "American Diabetes Association Professional Practice Committee for Diabetes",
      journal: "Diabetes Care 2026;49(Suppl 1):S246-S260",
      doi: "10.2337/dc26-S011",
    },
  },
  cards: [
    {
      id: "E1",
      requires: ["type_2_diabetes"],
      topic: "Kidney screening",
      guideline_says:
        "People with type 2 diabetes should be screened for CKD at least once a year, starting at diagnosis. Screening includes both a urine albumin test (UACR, which checks for protein in the urine) and eGFR (a blood test of how well the kidneys filter).",
      question_for_clinician:
        "When were the eGFR and urine albumin (UACR) last checked, and what were the results?",
      source: "ADA_KDIGO_2022",
      label: "Verified",
    },
    {
      id: "E2",
      requires: ["type_2_diabetes", "ckd"],
      topic: "SGLT2 inhibitor for kidney protection",
      guideline_says:
        "An SGLT2 inhibitor with proven kidney or heart benefit is recommended for people with type 2 diabetes and CKD when eGFR is at least 20. Once started, it can be continued, if tolerated, until dialysis begins.",
      question_for_clinician:
        "Is an SGLT2 inhibitor appropriate given the latest eGFR, and if one is already prescribed, should it continue?",
      source: "ADA_KDIGO_2022",
      label: "Verified",
    },
    {
      id: "E3",
      requires: ["heart_failure"],
      topic: "SGLT2 inhibitor in heart failure",
      guideline_says:
        "The 2023 ESC focused update recommends an SGLT2 inhibitor (dapagliflozin or empagliflozin) for heart failure with mildly reduced or preserved ejection fraction, to lower the risk of a heart failure hospital stay or heart-related death. This is the guideline's strongest recommendation.",
      question_for_clinician:
        "Given the heart failure type and ejection fraction, would an SGLT2 inhibitor lower the risk of hospitalization?",
      source: "ESC_HF_2023",
      label: "Verified",
    },
    {
      id: "E4",
      requires: ["type_2_diabetes", "ckd"],
      medication_trigger: ["metformin"],
      topic: "Metformin and kidney function",
      guideline_says:
        "Metformin is recommended in type 2 diabetes with CKD when eGFR is at least 30. A lower dose is usually needed when eGFR is 30 to 44.",
      question_for_clinician: "Does the current metformin dose still fit the latest eGFR?",
      source: "ADA_KDIGO_2022",
      label: "Verified",
    },
    {
      id: "E5",
      requires: ["type_2_diabetes", "ckd"],
      topic: "ACE inhibitor or ARB with albuminuria",
      guideline_says:
        "An ACE inhibitor or ARB is recommended for people with diabetes who have high blood pressure and albuminuria (protein in the urine), slowly raised to the highest dose the person tolerates. Combining an ACE inhibitor with an ARB is not advised because of high potassium and acute kidney injury risk.",
      question_for_clinician:
        "Is there albuminuria, and is the blood pressure medicine an ACE inhibitor or ARB at the highest tolerated dose?",
      source: "ADA_KDIGO_2022",
      label: "Verified",
    },
    {
      id: "E6",
      requires: ["type_2_diabetes", "ckd"],
      topic: "Finerenone",
      guideline_says:
        "Finerenone (a nonsteroidal MRA) is recommended for people with type 2 diabetes, eGFR of at least 25, normal potassium, and albuminuria (ACR of 30 mg/g or more) despite the maximum tolerated dose of an ACE inhibitor or ARB.",
      question_for_clinician:
        "If albuminuria persists on an ACE inhibitor or ARB, is finerenone an option, and what do the potassium levels show?",
      source: "ADA_KDIGO_2022",
      label: "Verified",
    },
    {
      id: "E7",
      requires: ["type_2_diabetes", "ckd"],
      topic: "GLP-1 receptor agonist",
      guideline_says:
        "ADA's 2026 Standards of Care recommend a GLP-1 receptor agonist with proven benefit for people with type 2 diabetes and CKD, to slow kidney disease and lower heart risk. A large trial (FLOW, NEJM 2024), in people with type 2 diabetes and CKD, found that semaglutide lowered the risk of a combined outcome by 24% compared with placebo. The combined outcome was kidney failure, a large drop in kidney function, or death from kidney or heart causes.",
      question_for_clinician:
        "Would a GLP-1 receptor agonist with proven kidney and heart benefit fit this person's care plan?",
      source: "ADA_CKD_2026",
      label: "Verified",
    },
    {
      id: "E8",
      requires: ["type_2_diabetes"],
      topic: "Blood pressure target",
      guideline_says:
        "ADA's 2026 Standards of Care say that for people with diabetes and high blood pressure, the goal is below 130/80 if it can be reached safely. For people at high risk of heart or kidney disease, ADA encourages a top number (systolic) below 120. Goals should be set together with the care team.",
      question_for_clinician:
        "What is the blood pressure target for this person, and are home readings meeting it?",
      source: "ADA_CVD_2026",
      label: "Verified",
    },
    {
      id: "E9",
      requires: ["heart_failure"],
      topic: "SGLT2 inhibitor in reduced ejection fraction",
      guideline_says:
        "The 2022 AHA/ACC/HFSA guideline strongly recommends SGLT2 inhibitors for people with symptoms of heart failure with reduced ejection fraction, to reduce hospital stays and heart-related death, whether or not the person has type 2 diabetes.",
      question_for_clinician:
        "If the ejection fraction is reduced, is an SGLT2 inhibitor part of the heart failure treatment plan?",
      source: "AHA_HF_2022",
      label: "Verified",
    },
    {
      id: "E10",
      requires: ["heart_failure", "type_2_diabetes"],
      topic: "Nonsteroidal MRA in heart failure with ejection fraction above 40%",
      guideline_says:
        "ADA's 2026 Standards of Care recommend a nonsteroidal MRA with proven benefit (such as finerenone) for people with diabetes who have heart failure symptoms and an ejection fraction above 40%, to lower the risk of heart failure getting worse. ADA says it should not be used together with another MRA.",
      question_for_clinician:
        "Given the ejection fraction and current heart failure medicines, is a nonsteroidal MRA an option, and what do the potassium and kidney tests show?",
      source: "ADA_CVD_2026",
      label: "Verified",
    },
    {
      id: "E11",
      requires: ["type_2_diabetes", "ckd"],
      topic: "SGLT2 inhibitor to prevent heart failure",
      guideline_says:
        "The 2023 ESC focused update recommends an SGLT2 inhibitor (dapagliflozin or empagliflozin) for people with type 2 diabetes and CKD, to lower the risk of a heart failure hospital stay or heart-related death. This is the guideline's strongest recommendation.",
      question_for_clinician:
        "Does the current plan include a medicine that lowers heart failure risk given both diabetes and CKD?",
      source: "ESC_HF_2023",
      label: "Verified",
    },
    {
      id: "E12",
      requires: ["type_2_diabetes", "ckd"],
      topic: "SGLT2 inhibitor and finerenone together",
      guideline_says:
        "ADA's 2026 Standards of Care say starting an SGLT2 inhibitor and finerenone at the same time can be considered for adults with type 2 diabetes who take a medicine that blocks the renin-angiotensin system (such as an ACE inhibitor or ARB), have a urine albumin (UACR) of 100 or more, and have an eGFR of 30 to 90. A 6-month study (CONFIDENCE, NEJM 2025) found that starting both together lowered urine albumin more than either drug alone, with no unexpected safety problems. It did not measure kidney failure or other long-term outcomes.",
      question_for_clinician:
        "Do the latest UACR and eGFR results fit the range where these two medicines can be considered together?",
      source: "ADA_CKD_2026",
      label: "Verified",
    },
  ],
};
