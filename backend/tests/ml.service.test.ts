const mockPost = jest.fn();
const mockGet = jest.fn();
const mockDelete = jest.fn();

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: mockPost,
    get: mockGet,
    delete: mockDelete,
    interceptors: { response: { use: jest.fn() } },
  })),
}));

import { MLService } from '../src/services/ml.service';
import { AppError } from '../src/utils/errors';

describe('MLService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts the complete chat request and returns ML data', async () => {
    const payload = { answer: 'Grounded answer', citations: [] };
    mockPost.mockResolvedValue({ data: payload });

    const result = await MLService.chat('user-1', 'session-1', 'Question?', ['doc-1'], [
      { role: 'user', content: 'Earlier question' },
    ]);

    expect(mockPost).toHaveBeenCalledWith('/api/v1/ml/chat', {
      user_id: 'user-1',
      conversation_id: 'session-1',
      question: 'Question?',
      document_ids: ['doc-1'],
      conversation_history: [{ role: 'user', content: 'Earlier question' }],
    }, expect.objectContaining({ headers: expect.objectContaining({ 'X-User-Id': 'user-1' }) }));
    expect(result).toEqual(payload);
  });

  it('reconciles a timeout only with completion of the exact request', async () => {
    mockPost.mockRejectedValueOnce(new AppError('Timeout', 504, 'ML_SERVICE_TIMEOUT'));
    const completed = { status: 'ready', analysis: { summary: [] } };
    mockGet.mockResolvedValueOnce({ data: { completed: true, result: completed } });
    expect(await MLService.processDocument('doc', 'owner', 'file.pdf', 'file.pdf', 'operation')).toEqual(completed);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/ml/documents/doc/completion', expect.objectContaining({ params: { user_id: 'owner', request_id: 'operation' } }));
  });

  it('does not treat old indexed chunks as proof of a timed-out reprocess', async () => {
    mockPost.mockRejectedValueOnce(new AppError('Timeout', 504, 'ML_SERVICE_TIMEOUT'));
    mockGet.mockResolvedValueOnce({ data: { completed: false, result: null } });
    await expect(MLService.processDocument('doc', 'owner', 'file.pdf')).rejects.toMatchObject({ code: 'ML_SERVICE_TIMEOUT' });
  });
});
