#!/usr/bin/env python3
"""Static triage, not a SQL evaluator or effective-ACL/security proof.

Lists each public CREATE TABLE and named table GRANT/REVOKE across all migration
files. Later REVOKEs, dynamic SQL, role inheritance, dropped tables and views need
manual review. Do not use this output to automatically generate GRANT statements.
"""
import re
from pathlib import Path
root = Path(__file__).resolve().parent.parent
files = sorted((root / 'supabase/migrations').glob('*.sql'))
objects = {}
access = []
for file in files:
    sql = re.sub(r'/\*[\s\S]*?\*/|--[^\n]*', '', file.read_text())
    for match in re.finditer(r'\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?((?:\w+\.)?\w+)\s*\(', sql, re.I):
        name = match[1].lower()
        if '.' in name and not name.startswith('public.'):
            continue
        name = name.removeprefix('public.')
        objects.setdefault(name, []).append(file.name)
    for match in re.finditer(r'\b(grant|revoke)\s+([^;]+?)\s+on\s+(?:table\s+)?([^;]+?)\s+(?:to|from)\s+([^;]+);', sql, re.I):
        for target in match[3].lower().split(','):
            access.append((target.strip().removeprefix('public.'), match[1].upper(), file.name, match[2].strip(), match[4].strip()))
print('# Public table grant inventory\n')
print('Static inventory of %d SQL files. A named GRANT is not proof of sufficient or safe access.\n' % len(files))
print('A missing named GRANT is a review candidate, not an instruction to expose the table.\n')
print('| Table | CREATE files | Named access statements |')
print('| --- | --- | --- |')
missing = 0
for name, origins in sorted(objects.items()):
    decisions = [x for x in access if x[0] == name]
    if not any(x[1] == 'GRANT' for x in decisions):
        missing += 1
    desc = '<br>'.join(f'{verb} {privileges} → {roles} ({file})' for _,verb,file,privileges,roles in decisions) or '**No named GRANT/REVOKE found**'
    print('| `%s` | %s | %s |' % (name, '<br>'.join(origins), desc))
print('\n%d distinct CREATE TABLE names; %d without a named GRANT anywhere in these files.' % (len(objects), missing))
