import { readWranglerConfig } from './readWranglerConfig'

export const getD1Databases = async () => {
  const config = await readWranglerConfig()

  // todo(justinvdm, 2024-11-21): Support multiple databases
  const db0 = config.d1_databases[0]

  return {
    [db0.binding]: db0.database_id
  }
}