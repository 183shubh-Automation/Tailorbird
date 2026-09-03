/**
 * Draw report PDFs (Draw Reporting -> Historical Draws -> PDF action icon) are served from a
 * signed, cookie-free CDN URL (files.tailorbird.com) that is reachable with a plain HTTPS GET —
 * no browser session/auth needed. This downloads that URL's bytes and extracts its text so a
 * test can assert on the PDF's actual content instead of only its existence.
 */
const https = require('https');
const pdfParse = require('pdf-parse');

/**
 * @param {string} url Signed PDF URL (e.g. read from the historical draw's PDF preview iframe `src`)
 * @returns {Promise<Buffer>}
 */
function downloadPdfBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`PDF download failed: HTTP ${res.statusCode} for ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Downloads the PDF at `url` and returns both its raw extracted text and a whitespace-stripped
 * version. The generated draw PDF renders some headings with a letter-spaced font effect that
 * pdf-parse extracts as literal space-separated characters (e.g. "S C H E D U L E") while
 * dollar amounts and invoice numbers extract cleanly — stripping all whitespace before matching
 * makes assertions robust to that font-kerning artifact without weakening what's checked.
 * @param {string} url
 * @returns {Promise<{ buffer: Buffer, numpages: number, text: string, normalized: string }>}
 */
async function downloadAndExtractPdfText(url) {
    const buffer = await downloadPdfBuffer(url);
    if (buffer.slice(0, 4).toString() !== '%PDF') {
        throw new Error(`Downloaded content at ${url} is not a PDF (missing %PDF header)`);
    }
    const data = await pdfParse(buffer);
    return {
        buffer,
        numpages: data.numpages,
        text: data.text,
        normalized: data.text.replace(/\s+/g, ''),
    };
}

module.exports = { downloadPdfBuffer, downloadAndExtractPdfText };
