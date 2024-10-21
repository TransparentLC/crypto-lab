export default (x: number) => {
    const units = ['TB', 'GB', 'MB', 'KB'];
    let unit = 'Bytes';
    while (units.length && x >= 1024) {
        x /= 1024;
        unit = units.pop()!;
    }
    return `${Math.round(x * 100) / 100} ${unit}`;
};
