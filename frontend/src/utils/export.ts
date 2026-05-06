/**
 * 将数据数组转换为 CSV 字符串
 */
export function toCSV<T extends Record<string, any>>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map(c => `"${c.header}"`).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * 下载 CSV 文件
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下载 Excel 文件（CSV 重命名为 .xlsx，Excel 可直接打开）
 */
export function downloadExcel(content: string, filename: string) {
  // 实际上是 CSV 格式，但 Excel 可直接打开
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
