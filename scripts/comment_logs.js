const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/zccz2/OneDrive/Desktop/pw/complete/social_media/src'.replace(/\\/g, '/');

function listFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      results = results.concat(listFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(ent.name)) {
      results.push(full);
    }
  }
  return results;
}

function commentConsoleLogs(code) {
  const lines = code.split(/\r?\n/);
  let out = [];
  let inBlockComment = false;
  let inString = false;
  let stringChar = '';
  let braceStack = [];
  let blockTypes = ['other'];

  const pushBlock = (t) => blockTypes.push(t || 'other');
  const popBlock = () => blockTypes.pop();
  const currentBlock = () => blockTypes[blockTypes.length - 1] || null;

  function replaceConsoleLog(fragment) {
    if (currentBlock() === 'catch') return fragment;
    return fragment.replace(/console\.log\s*\(([^)]*)\)/g, () => `/* console.log(...) */ void 0`);
  }

  for (let rawLine of lines) {
    let i = 0;
    let buf = '';
    let line = rawLine;

    while (i < line.length) {
      const ch = line[i];
      const ch2 = line[i + 1];

      // line comment
      if (!inString && !inBlockComment && ch === '/' && ch2 === '/') {
        buf = buf.replace(/console\.log\s*\([^)]*\)/g, (m) => replaceConsoleLog(m));
        buf += line.slice(i);
        i = line.length;
        break;
      }

      // block comment start
      if (!inString && !inBlockComment && ch === '/' && ch2 === '*') {
        buf = buf.replace(/console\.log\s*\([^)]*\)/g, (m) => replaceConsoleLog(m));
        inBlockComment = true;
        buf += '/*';
        i += 2;
        continue;
      }

      // block comment end
      if (inBlockComment) {
        buf += ch;
        if (ch === '*' && ch2 === '/') {
          buf += '/';
          inBlockComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      // strings
      if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
        inString = true;
        stringChar = ch;
        buf += ch;
        i++;
        continue;
      }
      if (inString) {
        buf += ch;
        if (ch === '\\') { // escape
          if (i + 1 < line.length) {
            buf += line[i + 1];
            i += 2;
            continue;
          }
        }
        if (ch === stringChar) {
          inString = false;
          stringChar = '';
        }
        i++;
        continue;
      }

      // braces and block detection
      if (ch === '{') {
        const tail = buf.slice(Math.max(0, buf.length - 50));
        let type = 'other';
        if (/try\s*$/.test(tail)) type = 'try';
        else if (/catch\s*\([^)]*\)\s*$/.test(tail)) type = 'catch';
        else if (/finally\s*$/.test(tail)) type = 'finally';
        pushBlock(type);
        braceStack.push('{');
        buf += ch;
        i++;
        continue;
      }
      if (ch === '}') {
        if (braceStack.length) braceStack.pop();
        if (blockTypes.length > 1) popBlock();
        buf += ch;
        i++;
        continue;
      }

      // normal char
      buf += ch;
      i++;
    }

    if (!inBlockComment) {
      buf = buf.replace(/console\.log\s*\([^)]*\)/g, (m) => replaceConsoleLog(m));
    }

    out.push(buf);
  }

  return out.join('\n');
}

function processFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  const updated = commentConsoleLogs(original);
  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf8');
    return true;
  }
  return false;
}

(function main() {
  const files = listFiles(ROOT);
  let changed = 0;
  for (const f of files) {
    if (processFile(f)) changed++;
  }
  console.log(JSON.stringify({ files: files.length, changed }, null, 2));
})();
