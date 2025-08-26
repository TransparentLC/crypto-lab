export default (x: number) => {
    const units = ['TB', 'GB', 'MB', 'KB'];
    let unit = 'Bytes';
    while (units.length && x >= 1024) {
        x /= 1024;
        // biome-ignore lint/style/noNonNullAssertion: 不可能 pop 出 undefined
        unit = units.pop()!;
    }
    return `${Math.round(x * 100) / 100} ${unit}`;
};
