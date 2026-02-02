#!/usr/bin/env node
const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('../spec.json', 'utf-8'));

const type = p => {
    if (!p) {
        return '';
    } else if (p.const) {
        return `\`"${p.const}"\``;
    } else if (p.enum) {
        return `\`(${p.enum.map(v => `"${v}"`).join(' \\| ')})\``;
    } else if (p.$ref) {
        return `[\`${p.$ref.split('/').pop()}\`](#${p.$ref.split('/').pop().toLowerCase()})`;
    } else if (p.oneOf) {
        return p.oneOf.map(type).join(' \\| ');
    } else if (p.type === 'array') {
        return p.items
            ? type(p.items).endsWith('`')
                ? `\`${type(p.items).replaceAll('`', '')}[]\``
                : `${type(p.items)}\`[]\``
            : '`array`';
    } else if (p.type === 'object' && p.additionalProperties) {
        return `\`Map<string, \`${type(p.additionalProperties)}\`>\``;
    }

    return p.type ? `\`${p.type}\`` : '';
};

const table = (props, req = []) => {
    if (!props) return '';

    let t = '| Field | Type | Description |\n| ----- | ---- | ----------- |\n';
    for (const [k, v] of Object.entries(props)) {
        t += `| ${k} | ${type(v)} | ${req.includes(k) ? '**REQUIRED**. ' : ''}${v.description || ''} |\n`;
    }

    return t + '\n';
};

let md = `# SchemaFX Schema\n\n`;
md += `## SchemaFX Object\n\n${table(schema.properties, schema.required)}`;

for (const [name, def] of Object.entries(schema.$defs || {})) {
    md += `## ${name}\n\n`;

    if (def.oneOf && !def.properties) {
        md += `One of: ${def.oneOf.map(type).join(' | ')}\n\n`;
    } else {
        if (def.description) md += `${def.description}\n\n`;
        md += table(def.properties, def.required);
    }
}

fs.writeFileSync('../spec.md', md);
console.log('Generated spec.md');
