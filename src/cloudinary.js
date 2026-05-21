// ─── Cloudinary Config ────────────────────────────────────────────────────────
// 1. Sign up free at https://cloudinary.com
// 2. Replace CLOUD_NAME with your Cloud Name (found on your Cloudinary dashboard)
// 3. Replace UPLOAD_PRESET with your unsigned preset name
//    (Settings → Upload → Upload Presets → Add Upload Preset → Signing Mode: Unsigned)

export const CLOUDINARY_CLOUD_NAME = 'dmbx0y0v3';
export const CLOUDINARY_UPLOAD_PRESET = 'tec_weekly_unsigned';

/**
 * Uploads a file to Cloudinary using an unsigned upload preset.
 * @param {File} file - The file to upload
 * @param {string} folder - The folder to store the file in (e.g. 'profilePics', 'proofs')
 * @param {function} onProgress - Optional callback (percent: number) => void
 * @returns {Promise<string>} - The secure URL of the uploaded file
 */
export function uploadToCloudinary(file, folder = 'uploads', onProgress = null) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);

    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.secure_url);
      } else {
        let errMsg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          errMsg = err?.error?.message || errMsg;
        } catch (_) {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload. Check your internet connection.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.timeout = 60000; // 60s timeout

    xhr.send(formData);
  });
}
