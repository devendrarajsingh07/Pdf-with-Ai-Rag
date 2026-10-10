import { documents } from '../models';

type DocumentRow = typeof documents.$inferSelect;

export type DocumentDto = Omit<DocumentRow, 'filePath' | 'mlDocumentId'>;

export function toDocumentDto(document: DocumentRow): DocumentDto {
  const { filePath: _filePath, mlDocumentId: _mlDocumentId, ...dto } = document;
  return dto;
}
