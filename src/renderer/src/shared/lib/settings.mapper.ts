import { SettingsSchema, SETTINGS_KEY_MAP, DEFAULT_SETTINGS } from '@common/types/settings'

export class SettingsMapper {
  /**
   * Converts a flat database settings map into a structured SettingsSchema object.
   * Handles JSON parsing for arrays/objects and boolean string conversion.
   */
  static toSchema(flatSettings: Record<string, string>): SettingsSchema {
    const schema = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as SettingsSchema

    for (const [dbKey, path] of Object.entries(SETTINGS_KEY_MAP)) {
      const rawValue = flatSettings[dbKey]
      if (rawValue === undefined) continue

      this.setByPath(schema, path as string, this.parseValue(rawValue))
    }

    // Special case: domain_overrides (dynamic keys)
    const domainOverrides: Record<string, string> = {}
    for (const [key, val] of Object.entries(flatSettings)) {
      if (key.startsWith('domain_override_')) {
        const pkg = key.replace('domain_override_', '')
        domainOverrides[pkg] = val
      }
    }
    schema.extensions.domainOverrides = domainOverrides

    return schema
  }

  private static parseValue(val: string): any {
    if (val === 'true') return true
    if (val === 'false') return false
    if (val.startsWith('[') || val.startsWith('{')) {
      try {
        return JSON.parse(val)
      } catch {
        return val
      }
    }
    const num = Number(val)
    if (!isNaN(num) && val.trim() !== '') return num
    return val
  }

  private static setByPath(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) current[parts[i]] = {}
      current = current[parts[i]]
    }
    current[parts[parts.length - 1]] = value
  }
}
