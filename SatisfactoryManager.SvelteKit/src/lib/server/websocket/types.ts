import { z } from 'zod';

// WebSocket message types
export const WebSocketMessageTypeSchema = z.enum([
	'auth',
	'join_game',
	'leave_game',
	'presence_update',
	'production_instance_created',
	'production_instance_updated',
	'production_instance_deleted',
	'site_created',
	'site_updated',
	'site_deleted',
	'user_joined',
	'user_left',
	'module_version_changed',
	'ping',
	'pong',
	'error'
]);

export type WebSocketMessageType = z.infer<typeof WebSocketMessageTypeSchema>;

// Base message structure
export const BaseWebSocketMessageSchema = z.object({
	type: WebSocketMessageTypeSchema,
	timestamp: z.string().datetime(),
	messageId: z.string().uuid()
});

// Authentication message
export const AuthMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('auth'),
	data: z.object({
		token: z.string()
	})
});

// Join/Leave game messages
export const JoinGameMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('join_game'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid().optional()
	})
});

export const LeaveGameMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('leave_game'),
	data: z.object({
		gameId: z.string().uuid()
	})
});

// Presence update
export const PresenceUpdateMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('presence_update'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid().optional(),
		activity: z.string().optional()
	})
});

// Production instance messages
export const ProductionInstanceCreatedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('production_instance_created'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid(),
		instanceId: z.string().uuid(),
		instanceData: z.any(), // Will contain the full production instance data
		userId: z.string().uuid(),
		userName: z.string()
	})
});

export const ProductionInstanceUpdatedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('production_instance_updated'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid(),
		instanceId: z.string().uuid(),
		changes: z.any(), // Will contain the changed fields
		instanceData: z.any(), // Will contain the updated production instance data
		userId: z.string().uuid(),
		userName: z.string()
	})
});

export const ProductionInstanceDeletedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('production_instance_deleted'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid(),
		instanceId: z.string().uuid(),
		userId: z.string().uuid(),
		userName: z.string()
	})
});

// Site messages
export const SiteCreatedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('site_created'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid(),
		siteName: z.string(),
		userId: z.string().uuid(),
		userName: z.string()
	})
});

export const SiteUpdatedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('site_updated'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid(),
		siteName: z.string(),
		userId: z.string().uuid(),
		userName: z.string()
	})
});

export const SiteDeletedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('site_deleted'),
	data: z.object({
		gameId: z.string().uuid(),
		siteId: z.string().uuid(),
		userId: z.string().uuid(),
		userName: z.string()
	})
});

// User presence messages
export const UserJoinedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('user_joined'),
	data: z.object({
		gameId: z.string().uuid(),
		userId: z.string().uuid(),
		userName: z.string(),
		userEmail: z.string(),
		siteId: z.string().uuid().optional(),
		activity: z.string().optional()
	})
});

export const UserLeftMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('user_left'),
	data: z.object({
		gameId: z.string().uuid(),
		userId: z.string().uuid(),
		userName: z.string()
	})
});

// Module version changed
export const ModuleVersionChangedMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('module_version_changed'),
	data: z.object({
		gameId: z.string().uuid(),
		moduleId: z.string().uuid(),
		moduleName: z.string(),
		oldVersion: z.string().optional(),
		newVersion: z.string(),
		userId: z.string().uuid(),
		userName: z.string()
	})
});

// Ping/Pong messages
export const PingMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('ping')
});

export const PongMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('pong')
});

// Error message
export const ErrorMessageSchema = BaseWebSocketMessageSchema.extend({
	type: z.literal('error'),
	data: z.object({
		code: z.string(),
		message: z.string(),
		details: z.any().optional()
	})
});

// Union type for all messages
export const WebSocketMessageSchema = z.union([
	AuthMessageSchema,
	JoinGameMessageSchema,
	LeaveGameMessageSchema,
	PresenceUpdateMessageSchema,
	ProductionInstanceCreatedMessageSchema,
	ProductionInstanceUpdatedMessageSchema,
	ProductionInstanceDeletedMessageSchema,
	SiteCreatedMessageSchema,
	SiteUpdatedMessageSchema,
	SiteDeletedMessageSchema,
	UserJoinedMessageSchema,
	UserLeftMessageSchema,
	ModuleVersionChangedMessageSchema,
	PingMessageSchema,
	PongMessageSchema,
	ErrorMessageSchema
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;
export type LeaveGameMessage = z.infer<typeof LeaveGameMessageSchema>;
export type PresenceUpdateMessage = z.infer<typeof PresenceUpdateMessageSchema>;
export type ProductionInstanceCreatedMessage = z.infer<
	typeof ProductionInstanceCreatedMessageSchema
>;
export type ProductionInstanceUpdatedMessage = z.infer<
	typeof ProductionInstanceUpdatedMessageSchema
>;
export type ProductionInstanceDeletedMessage = z.infer<
	typeof ProductionInstanceDeletedMessageSchema
>;
export type SiteCreatedMessage = z.infer<typeof SiteCreatedMessageSchema>;
export type SiteUpdatedMessage = z.infer<typeof SiteUpdatedMessageSchema>;
export type SiteDeletedMessage = z.infer<typeof SiteDeletedMessageSchema>;
export type UserJoinedMessage = z.infer<typeof UserJoinedMessageSchema>;
export type UserLeftMessage = z.infer<typeof UserLeftMessageSchema>;
export type ModuleVersionChangedMessage = z.infer<typeof ModuleVersionChangedMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// Connection info
export interface ConnectionInfo {
	id: string;
	userId: string;
	userEmail: string;
	userName: string;
	gameId: string | null;
	siteId: string | null;
	lastPing: Date;
	connectedAt: Date;
	role: string | null; // User role in the current game
}

// Game room info
export interface GameRoom {
	gameId: string;
	connections: Set<string>; // Connection IDs
	userPresence: Map<
		string,
		{
			userId: string;
			userName: string;
			userEmail: string;
			siteId: string | null;
			activity: string | null;
			lastSeen: Date;
		}
	>;
}
