type LogLevel = 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };
  const line = `${JSON.stringify(entry)}\n`;
  if (level === 'error') {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};
