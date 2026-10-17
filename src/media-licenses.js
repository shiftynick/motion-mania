export const commercialLicenses = ['by', 'by-sa', 'cc0', 'pdm'];

export function classifyLicense(value = '') {
  const text = String(value).toLowerCase().replace(/creative commons/g, 'cc').replace(/attribution/g, 'by').replace(/share[ -]?alike/g, 'sa').replace(/non[ -]?commercial/g, 'nc').replace(/no[ -]?derivatives/g, 'nd');
  const code = text.replace(/^https?:\/\/creativecommons.org\/(licenses|publicdomain)\//, '').replace(/^cc[ -]+/, '').replace(/\s+/g, '-').replace(/[- /]\d.*$/, '').replace(/\/$/, '');
  const nonCommercial = /(^|[- /])nc($|[- /+])/.test(code), noDerivatives = /(^|[- /])nd($|[- /])/.test(code);
  const attributionRequired = /^by($|[- /])/.test(code), shareAlike = /(^|[- /])sa($|[- /])/.test(code);
  const known = commercialLicenses.includes(code) || ['by-nc', 'by-nc-sa', 'by-nc-nd', 'by-nd', 'nc-sampling+', 'sampling+', 'pexels', 'zero', 'mark'].includes(code);
  return { code, known, nonCommercial, noDerivatives, attributionRequired, shareAlike, commercialUse: known && !nonCommercial, modification: known && !noDerivatives, filmSafe: commercialLicenses.includes(code) || ['pexels', 'zero', 'mark'].includes(code) };
}

export function licenseAllowed(license, allowRestricted = false) {
  const policy = classifyLicense(license);
  return policy.filmSafe || (allowRestricted && policy.known);
}

export function attributionText(asset) {
  const title = asset.title || 'Untitled', creator = asset.creator || 'Unknown creator';
  const credit = `"${title}" by ${creator}${asset.creatorUrl ? ` (${asset.creatorUrl})` : ''}. Source: ${asset.sourceUrl || 'not recorded'}. ${asset.license}${asset.licenseVersion ? ` ${asset.licenseVersion}` : ''}${asset.licenseUrl ? ` (${asset.licenseUrl})` : ''}.`;
  return asset.license === 'Pexels' ? `${credit} Videos provided by Pexels (https://www.pexels.com). Attribution appreciated but not required.` : credit;
}
