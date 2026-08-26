import type { ApiErrorCode } from '@todo/contracts';
export class ApiClientError extends Error { public constructor(public readonly code:ApiErrorCode, message:string, public readonly status:number){super(message);this.name='ApiClientError';} }
