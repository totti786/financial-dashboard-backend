import { z } from 'zod';

// ============================================================================
// User Response
// ============================================================================

export const UserResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  permission: z.string(),
  created_at: z.string(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

// ============================================================================
// Login
// ============================================================================

export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
  remember_me: z.boolean().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ============================================================================
// Register
// ============================================================================

export const RegisterRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
  permission: z.enum(['view', 'edit']).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

// ============================================================================
// Session
// ============================================================================

export const SessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: UserResponseSchema.optional(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
