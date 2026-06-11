import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const colorfulFunc = `
        const renderColorfulDigits = (text: string | number) => {
            const str = String(text);
            const colors = ["text-red-500", "text-orange-500", "text-amber-500", "text-green-500", "text-blue-500", "text-indigo-500", "text-purple-500", "text-pink-500"];
            let charIndex = 0;
            return str.split('').map((char, index) => {
                if (/[0-9]/.test(char)) {
                    const color = colors[charIndex % colors.length];
                    charIndex++;
                    return <span key={index} className={color + " drop-shadow-md font-extrabold"}>{char}</span>;
                }
                return <span key={index}>{char}</span>;
            });
        };
`

// inject into Run
content = content.replace(
    /const Run = \(\) => \{/,
    `const Run = () => {\n${colorfulFunc}`
);

// replace {displayDistance}
content = content.replace(
    /\{displayDistance\}/,
    `{renderColorfulDigits(displayDistance)}`
);

// change height: "58%" to flex: 1 overflowY: auto
content = content.replace(
    /style=\{\{ height: "58%" \}\}/,
    `style={{ minHeight: "60vh", flex: "1 1 auto", overflowY: "auto" }}`
);

fs.writeFileSync('src/App.tsx', content);
