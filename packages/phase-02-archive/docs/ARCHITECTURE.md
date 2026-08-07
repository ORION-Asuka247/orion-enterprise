# Phase 2 Architecture

## Why templates and rules are separate

A question describes what the engineer must record.

A rule describes how an answer is interpreted.

Separating the two allows ORION to change a compliance rule without rewriting the field workflow.

## Version preservation

`inspection_template_versions` preserves the form structure.

`compliance_rule_versions` preserves the compliance logic.

`inspections.rule_snapshot` stores the exact rule definitions relevant to the inspection.

Completed historical inspections therefore remain interpretable even after future rules change.

## Evidence

Evidence requirements live at question level.

The submission validator prevents completion where mandatory answers or evidence are missing.

Original evidence is stored separately from answers so photographs and documents remain first-class records.

## Defects

A failed answer can create a defect linked to:

- company
- property
- asset
- inspection
- exact failed answer
- exact evaluated rule version

This gives ORION full traceability from regulation/rule to defect and later remedial work.

## Regulatory integration

Phase 5 Regulatory Intelligence will create new approved versions of `compliance_rule_versions`.

It will not rewrite historical records.
