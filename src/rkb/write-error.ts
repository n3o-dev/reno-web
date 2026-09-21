/** Raised when a workbook cannot be written the way the spec requires. */
export class RkbWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RkbWriteError'
  }
}
