export interface GeneratorTypeDto {
  id: string
  typeName: string
  consumptionRate: number
  notes?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface StationDto {
  id: string
  stationCode: string
  stationName: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  generatorTypeId: string
  generatorType?: GeneratorTypeDto
  maxCapacity: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BulkUpsertRow {
  station_code: string
  station_name?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  generator_type_name: string
  consumption_rate?: number | null
  max_capacity?: number
}

export interface BulkUpsertResult {
  station_code: string
  station_id: string
  action: 'created' | 'updated'
  warning: string | null
}
