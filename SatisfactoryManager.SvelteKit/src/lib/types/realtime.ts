// Real-time message types for SSE communication

export type RealtimeMessageType = 
	| 'production_instance_created'
	| 'production_instance_updated'
	| 'production_instance_deleted'
	| 'site_created'
	| 'site_updated'
	| 'site_deleted'
	| 'user_joined'
	| 'user_left'
	| 'module_version_changed';

// Base message structure
export interface BaseRealtimeMessage {
	type: RealtimeMessageType;
	timestamp: string;
	messageId: string;
}

// Production instance messages
export interface ProductionInstanceCreatedMessage extends BaseRealtimeMessage {
	type: 'production_instance_created';
	data: {
		gameId: string;
		siteId: string;
		instanceId: string;
		instanceData: any; // Will contain the full production instance data
		userId: string;
		userName: string;
	};
}

export interface ProductionInstanceUpdatedMessage extends BaseRealtimeMessage {
	type: 'production_instance_updated';
	data: {
		gameId: string;
		siteId: string;
		instanceId: string;
		changes: any; // Will contain the changed fields
		instanceData: any; // Will contain the updated production instance data
		userId: string;
		userName: string;
	};
}

export interface ProductionInstanceDeletedMessage extends BaseRealtimeMessage {
	type: 'production_instance_deleted';
	data: {
		gameId: string;
		siteId: string;
		instanceId: string;
		userId: string;
		userName: string;
	};
}

// Site messages
export interface SiteCreatedMessage extends BaseRealtimeMessage {
	type: 'site_created';
	data: {
		gameId: string;
		siteId: string;
		siteName: string;
		userId: string;
		userName: string;
	};
}

export interface SiteUpdatedMessage extends BaseRealtimeMessage {
	type: 'site_updated';
	data: {
		gameId: string;
		siteId: string;
		siteName: string;
		userId: string;
		userName: string;
	};
}

export interface SiteDeletedMessage extends BaseRealtimeMessage {
	type: 'site_deleted';
	data: {
		gameId: string;
		siteId: string;
		userId: string;
		userName: string;
	};
}

// User presence messages
export interface UserJoinedMessage extends BaseRealtimeMessage {
	type: 'user_joined';
	data: {
		gameId: string;
		userId: string;
		userName: string;
		userEmail: string;
		siteId?: string;
		activity?: string;
	};
}

export interface UserLeftMessage extends BaseRealtimeMessage {
	type: 'user_left';
	data: {
		gameId: string;
		userId: string;
		userName: string;
	};
}

// Module version changed
export interface ModuleVersionChangedMessage extends BaseRealtimeMessage {
	type: 'module_version_changed';
	data: {
		gameId: string;
		moduleId: string;
		moduleName: string;
		oldVersion?: string;
		newVersion: string;
		userId: string;
		userName: string;
	};
}

// Union type for all messages
export type RealtimeMessage = 
	| ProductionInstanceCreatedMessage
	| ProductionInstanceUpdatedMessage
	| ProductionInstanceDeletedMessage
	| SiteCreatedMessage
	| SiteUpdatedMessage
	| SiteDeletedMessage
	| UserJoinedMessage
	| UserLeftMessage
	| ModuleVersionChangedMessage;