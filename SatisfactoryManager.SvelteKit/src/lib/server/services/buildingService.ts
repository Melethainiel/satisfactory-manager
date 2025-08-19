import { db } from '../db';
import {
	buildings,
	buildingVersions,
	type Building,
	type NewBuilding,
	type BuildingVersion,
	type NewBuildingVersion,
	type BuildingType
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export interface IBuildingService {
	// Building CRUD operations
	getAllBuildings(): Promise<Building[]>;
	getBuildingById(id: string): Promise<Building | undefined>;
	getBuildingByClassName(className: string): Promise<Building | undefined>;
	createBuilding(data: Omit<NewBuilding, 'id' | 'createdAt' | 'updatedAt'>): Promise<Building>;
	updateBuilding(
		id: string,
		data: Partial<Omit<NewBuilding, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Building | undefined>;
	deleteBuilding(id: string): Promise<boolean>;

	// Building version management
	getBuildingVersions(buildingId: string): Promise<BuildingVersion[]>;
	getBuildingVersionsByModuleVersion(moduleVersionId: string): Promise<BuildingVersion[]>;
	addBuildingVersion(
		buildingId: string,
		versionData: Omit<NewBuildingVersion, 'id' | 'buildingId' | 'createdAt'>
	): Promise<BuildingVersion>;
	getBuildingVersionByModuleAndBuilding(
		buildingId: string,
		moduleVersionId: string
	): Promise<BuildingVersion | undefined>;

	// Bulk operations
	bulkCreateBuildings(
		buildingsData: Omit<NewBuilding, 'id' | 'createdAt' | 'updatedAt'>[]
	): Promise<Building[]>;
	bulkCreateBuildingVersions(
		versionsData: Omit<NewBuildingVersion, 'id' | 'createdAt'>[]
	): Promise<BuildingVersion[]>;

	// Helper methods
	getBuildingsByType(type: BuildingType): Promise<Building[]>;
}

class BuildingService implements IBuildingService {
	async getAllBuildings(): Promise<Building[]> {
		return await db.select().from(buildings).orderBy(buildings.name);
	}

	async getBuildingById(id: string): Promise<Building | undefined> {
		const [row] = await db.select().from(buildings).where(eq(buildings.id, id));
		return row;
	}

	async getBuildingByClassName(className: string): Promise<Building | undefined> {
		const [row] = await db.select().from(buildings).where(eq(buildings.className, className));
		return row;
	}

	async createBuilding(
		data: Omit<NewBuilding, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<Building> {
		const [row] = await db.insert(buildings).values(data).returning();
		return row;
	}

	async updateBuilding(
		id: string,
		data: Partial<Omit<NewBuilding, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Building | undefined> {
		const [row] = await db
			.update(buildings)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(buildings.id, id))
			.returning();
		return row;
	}

	async deleteBuilding(id: string): Promise<boolean> {
		const res = await db
			.delete(buildings)
			.where(eq(buildings.id, id))
			.returning({ id: buildings.id });
		return res.length > 0;
	}

	async getBuildingVersions(buildingId: string): Promise<BuildingVersion[]> {
		return await db
			.select()
			.from(buildingVersions)
			.where(eq(buildingVersions.buildingId, buildingId))
			.orderBy(desc(buildingVersions.createdAt));
	}

	async getBuildingVersionsByModuleVersion(moduleVersionId: string): Promise<BuildingVersion[]> {
		return await db
			.select()
			.from(buildingVersions)
			.where(eq(buildingVersions.moduleVersionId, moduleVersionId))
			.orderBy(buildingVersions.buildingId);
	}

	async addBuildingVersion(
		buildingId: string,
		versionData: Omit<NewBuildingVersion, 'id' | 'buildingId' | 'createdAt'>
	): Promise<BuildingVersion> {
		const [version] = await db
			.insert(buildingVersions)
			.values({
				buildingId,
				...versionData
			})
			.returning();
		return version;
	}

	async getBuildingVersionByModuleAndBuilding(
		buildingId: string,
		moduleVersionId: string
	): Promise<BuildingVersion | undefined> {
		const [row] = await db
			.select()
			.from(buildingVersions)
			.where(
				eq(buildingVersions.buildingId, buildingId) &&
					eq(buildingVersions.moduleVersionId, moduleVersionId)
			);
		return row;
	}

	async bulkCreateBuildings(
		buildingsData: Omit<NewBuilding, 'id' | 'createdAt' | 'updatedAt'>[]
	): Promise<Building[]> {
		if (buildingsData.length === 0) return [];
		return await db.insert(buildings).values(buildingsData).returning();
	}

	async bulkCreateBuildingVersions(
		versionsData: Omit<NewBuildingVersion, 'id' | 'createdAt'>[]
	): Promise<BuildingVersion[]> {
		if (versionsData.length === 0) return [];
		return await db.insert(buildingVersions).values(versionsData).returning();
	}

	async getBuildingsByType(type: BuildingType): Promise<Building[]> {
		return await db
			.select()
			.from(buildings)
			.where(eq(buildings.type, type))
			.orderBy(buildings.name);
	}
}

export const buildingService: IBuildingService = new BuildingService();
