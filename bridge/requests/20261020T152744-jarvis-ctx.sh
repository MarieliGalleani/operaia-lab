B=/home/ubuntu/.vscode-server/data/User/History
for f in $B/201b1367/3k5b.md $B/-7822ba6b/HbMP.html; do echo "=== $f"; grep -m1 -o '"resource":"[^"]*"' $(dirname $f)/entries.json 2>/dev/null; grep -io '.\{0,140\}jarvis.\{0,140\}' "$f" | head -4; done
T=/home/ubuntu/.vscode-server/data/User/workspaceStorage/f5dc5a9ab6132397f859b5e17a766136-1/GitHub.copilot-chat/transcripts/eb84b450-991b-48e0-a4ef-b619ce3a10e0.jsonl
echo "=== copilot transcript"; grep -io '.\{0,160\}jarvis.\{0,160\}' "$T" | grep -v -i 'token\|key\|secret' | head -5
