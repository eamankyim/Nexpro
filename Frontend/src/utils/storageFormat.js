export const formatStorageAmount = ({ mb, gb, unit = 'auto', decimals = 2 }) => {
  const megabytes = Number(mb);
  const gigabytes = Number(gb);

  if (unit === 'gb') {
    const value = Number.isFinite(megabytes)
      ? megabytes / 1024
      : Number.isFinite(gigabytes)
        ? gigabytes
        : 0;
    return `${value.toFixed(decimals)} GB`;
  }

  if (Number.isFinite(megabytes) && megabytes > 0 && megabytes < 1024) {
    return `${megabytes} MB`;
  }

  const value = Number.isFinite(megabytes) ? megabytes / 1024 : (Number.isFinite(gigabytes) ? gigabytes : 0);
  return `${value.toFixed(decimals)} GB`;
};

export const formatStoragePercentage = (percentage, currentMB) => {
  const percent = Number(percentage) || 0;
  const megabytes = Number(currentMB) || 0;
  if (percent === 0 && megabytes > 0) {
    return '<1%';
  }
  return `${percent}%`;
};
