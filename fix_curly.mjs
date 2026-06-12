import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /catch \(e\) \{\}\s*\}\s*setIsRunning\(false\);\s*\};\s*const togglePause/m;

const replacement = `catch (e) {}
            }
        }
        setIsRunning(false);
    };

    const togglePause`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
