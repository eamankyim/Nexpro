const {
  parseAiJsonResponse,
  repairTrailingCommas,
  closeTruncatedJson
} = require('../../../utils/parseAiJsonResponse');

describe('parseAiJsonResponse', () => {
  it('parses JSON wrapped in markdown fences', () => {
    const result = parseAiJsonResponse('```json\n{"keyFindings":["a"]}\n```');
    expect(result.ok).toBe(true);
    expect(result.value.keyFindings).toEqual(['a']);
  });

  it('parses JSON with trailing commas', () => {
    const result = parseAiJsonResponse('{"recommendations":[{"action":"x",},]}');
    expect(result.ok).toBe(true);
    expect(result.value.recommendations).toHaveLength(1);
  });

  it('repairs truncated JSON by closing brackets', () => {
    const truncated = '{"keyFindings":["one","two"';
    const closed = closeTruncatedJson(truncated);
    const result = parseAiJsonResponse(truncated);
    expect(closed.endsWith(']}') || closed.endsWith('"]}')).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('returns ok:false for non-JSON text', () => {
    const result = parseAiJsonResponse('Here is a narrative without JSON.');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('repairTrailingCommas', () => {
  it('removes trailing commas before closers', () => {
    expect(repairTrailingCommas('{"a":[1,2,],}')).toBe('{"a":[1,2]}');
  });
});
