export const HCS1_CHUNK_THRESHOLD = 1024;
export const HCS1_CHUNK_ENVELOPE_SIZE = 16; // JSON envelope overhead: {"o":NNN,"c":"..."} ≈ 16 bytes
export const HCS1_CHUNK_SIZE = HCS1_CHUNK_THRESHOLD - HCS1_CHUNK_ENVELOPE_SIZE;

export const HCS2_PROTOCOL = 'hcs-2' as const;

export const HCS2_OPERATION = {
  REGISTER: 'register',
  UPDATE: 'update',
  DELETE: 'delete',
  MIGRATE: 'migrate',
} as const;

export const HCS2_REGISTRY_TYPE = {
  INDEXED: 0,
  NON_INDEXED: 1,
} as const;
