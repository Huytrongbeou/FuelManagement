import * as employeeRepo from '../repositories/employee.repository'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status })
}

export async function listEmployees(includeInactive: boolean) {
  return employeeRepo.findMany(includeInactive)
}

export async function createEmployee(data: Record<string, unknown>) {
  const name = String(data.name ?? '').trim()
  const phone = data.phone == null ? null : String(data.phone).trim() || null
  if (!name) throw fail('Tên nhân viên là bắt buộc')
  if (name.length > 150) throw fail('Tên nhân viên quá dài')
  return employeeRepo.create({ name, phone })
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  if (!UUID_RE.test(id)) throw fail('Không tìm thấy nhân viên', 404)
  if (!(await employeeRepo.findById(id))) throw fail('Không tìm thấy nhân viên', 404)

  const patch: { name?: string; phone?: string | null; isActive?: boolean } = {}
  if (data.name !== undefined) {
    const name = String(data.name).trim()
    if (!name) throw fail('Tên nhân viên là bắt buộc')
    patch.name = name
  }
  if (data.phone !== undefined) patch.phone = String(data.phone).trim() || null
  if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive)
  if (Object.keys(patch).length === 0) throw fail('Không có thay đổi nào để lưu')
  return employeeRepo.update(id, patch)
}

/** Deactivate rather than delete, so stations still resolve the name of whoever managed them. */
export async function deactivateEmployee(id: string) {
  if (!UUID_RE.test(id)) throw fail('Không tìm thấy nhân viên', 404)
  if (!(await employeeRepo.findById(id))) throw fail('Không tìm thấy nhân viên', 404)
  return employeeRepo.update(id, { isActive: false })
}
