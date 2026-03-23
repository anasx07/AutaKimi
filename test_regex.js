const s1 = "3 سنوات";
const s2 = "6 أشهر";

const regex = /^(\d+)\s+([\u0600-\u06FF]+.*)$/;

console.log(`[s1] BEFORE: ${s1} -> AFTER: ${s1.replace(regex, '$2 $1')}`);
console.log(`[s2] BEFORE: ${s2} -> AFTER: ${s2.replace(regex, '$2 $1')}`);

const match1 = s1.match(regex);
const match2 = s2.match(regex);

console.log(`[s1] MATCH: ${!!match1}`);
console.log(`[s2] MATCH: ${!!match2}`);
