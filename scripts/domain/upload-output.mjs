const versionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function uploadedWorkerVersion(records, worker) {
  const fail = () => { throw new Error('Upload response requires reconciliation'); };
  if (!['frigo', 'frigo-staging'].includes(worker) || !Array.isArray(records)) fail();
  let upload;
  let session;
  for (const record of records) {
    if (!record || typeof record !== 'object' || record.version !== 1) fail();
    // Wrangler writes a session record before the upload result in the same JSONL file.
    if (record.type === 'wrangler-session') {
      if (session || upload) fail();
      session = record;
    } else if (record.type === 'version-upload') {
      if (upload) fail();
      upload = record;
    } else fail();
  }
  if (!upload || upload.worker_name !== worker || typeof upload.version_id !== 'string' ||
      !versionIdPattern.test(upload.version_id)) fail();
  return upload.version_id;
}
