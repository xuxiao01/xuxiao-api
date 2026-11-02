"""Route reviewed mianjing commits away from the shared API deployment."""
import re
import subprocess
import sys

ALLOWED = {'.gitignore', '.env.example', 'README.md', 'doc/README.md', 'package.json', 'pnpm-lock.yaml',
           'prisma/schema.prisma', 'src/app.ts', 'src/modules/index.ts', '.github/workflows/deploy.yml'}
PREFIXES = ('src/modules/mianjing/', 'doc/mianjing/', 'deploy/mianjing/',
            'prisma/migrations/20261102000000_add_mianjing/')


def classify(message, paths):
    if not re.match(r'^(feat|fix|refactor|chore|docs|test|perf)\(mianjing\):', message):
        return 'shared'
    unexpected = [p for p in paths if p not in ALLOWED and not p.startswith(PREFIXES) and p != 'tests/mianjing.api.test.ts']
    if unexpected:
        raise ValueError('Mianjing release contains unapproved files: ' + ', '.join(unexpected))
    return 'mianjing'


if __name__ == '__main__':
    before, after = sys.argv[1:]
    message = subprocess.check_output(['git', 'show', '-s', '--format=%B', after], text=True)
    paths = subprocess.check_output(['git', 'diff', '--name-only', before, after], text=True).splitlines()
    print(classify(message, paths))
