const fields = {
  ai: ['project'], assets: [], d1: ['database_id', 'id'],
  kv_namespace: ['namespace_id'], queue: ['queue_name'], r2_bucket: ['bucket_name'],
  send_email: ['destination_address', 'allowed_destination_addresses', 'allowed_sender_addresses'],
};

export function captureBindings(entries) {
  const bindings = {};
  const typedBindings = [];
  const vars = {};
  const secretNames = [];
  const names = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || names.has(entry.name)) throw new Error('Invalid or duplicate binding');
    names.add(entry.name);
    if (entry.type === 'plain_text') {
      if (Object.keys(entry).some((key) => !['name', 'type', 'text'].includes(key)) || typeof entry.text !== 'string') throw new Error('Unsupported variable shape');
      vars[entry.name] = entry.text;
    } else if (entry.type === 'secret_text') {
      if (Object.keys(entry).some((key) => !['name', 'type'].includes(key))) throw new Error('Secret values must never be captured');
      secretNames.push(entry.name);
    } else {
      if (!Object.hasOwn(fields, entry.type) || Object.keys(entry).some((key) => !['name', 'type', ...fields[entry.type]].includes(key))) throw new Error('Unsupported binding requires a new audit');
      typedBindings.push({ ...entry });
      const identity = entry.database_id || entry.namespace_id || entry.bucket_name || entry.queue_name;
      if (identity) bindings[entry.name] = identity;
    }
  }
  return { bindings, typedBindings: typedBindings.sort((a, b) => a.name.localeCompare(b.name)), vars, secretNames: secretNames.sort() };
}

export function configBindings(config) {
  const supported = ['$schema', 'name', 'main', 'compatibility_date', 'compatibility_flags', 'assets', 'd1_databases', 'kv_namespaces', 'r2_buckets', 'queues', 'ai', 'send_email', 'vars', 'routes', 'workers_dev', 'observability', 'triggers'];
  if (Object.keys(config).some((key) => !supported.includes(key))) throw new Error('Unsupported config field requires a new audit');
  return [
    ...(config.assets?.binding ? [{ name: config.assets.binding, type: 'assets' }] : []),
    ...(config.ai ? [{ name: config.ai.binding, type: 'ai', project: '<catalog>' }] : []),
    ...(config.d1_databases || []).map((b) => ({ name: b.binding, type: 'd1', database_id: b.database_id, id: b.database_id })),
    ...(config.kv_namespaces || []).map((b) => ({ name: b.binding, type: 'kv_namespace', namespace_id: b.id })),
    ...(config.r2_buckets || []).map((b) => ({ name: b.binding, type: 'r2_bucket', bucket_name: b.bucket_name })),
    ...(config.queues?.producers || []).map((b) => ({ name: b.binding, type: 'queue', queue_name: b.queue })),
    ...(config.send_email || []).map((b) => ({ ...b, type: 'send_email' })),
  ];
}
