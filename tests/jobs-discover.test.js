import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesRole, locationFlags, filterJobs } from '../src/jobs.js';
import { classifyResource } from '../src/discover.js';

test('matchesRole accepts AI/ML titles and rejects unrelated ones', () => {
  for (const title of ['Applied AI Engineer', 'Forward Deployed Engineer', 'Senior Machine Learning Engineer', 'Member of Technical Staff, Inference', 'Solutions Architect, Startups', 'Research Scientist, Alignment', 'AI Deployment Engineer']) {
    assert.ok(matchesRole(title), title);
  }
  for (const title of ['Account Executive, Enterprise', 'Executive Business Partner', 'Recruiting Coordinator', 'Workplace Experience Lead']) {
    assert.ok(!matchesRole(title), title);
  }
});

test('locationFlags detects Indian cities and remote', () => {
  assert.deepEqual(locationFlags('Bengaluru, India'), { india: true, remote: false });
  assert.deepEqual(locationFlags('Remote - US'), { india: false, remote: true });
  assert.deepEqual(locationFlags('New Delhi; Remote'), { india: true, remote: true });
  assert.deepEqual(locationFlags('San Francisco'), { india: false, remote: false });
});

test('filterJobs drops non-matching titles and annotates flags and board', () => {
  const out = filterJobs(
    [
      { id: '1', company: 'X', title: 'Applied AI Engineer', location: 'Mumbai, India', url: 'https://x/1' },
      { id: '2', company: 'X', title: 'Account Director', location: 'Mumbai, India', url: 'https://x/2' },
      { id: '3', company: 'X', title: 'ML Engineer', location: 'Remote', url: '' },
    ],
    { id: 'b' },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].india, true);
  assert.equal(out[0].board, 'b');
});

test('classifyResource flags courses, interview posts, videos and papers and ignores noise', () => {
  const base = { id: 'x', url: 'https://blog.example.com/p', title: '', summary: '', publishedAt: null, firstSeen: '2026-10-22T00:00:00.000Z', source: 's', sourceName: 'S' };
  assert.equal(classifyResource({ ...base, title: 'A new course on building agents' }).kind, 'course');
  assert.equal(classifyResource({ ...base, title: 'My Anthropic interview experience' }).kind, 'interview');
  assert.equal(classifyResource({ ...base, title: 'Attention from scratch, step by step', url: 'https://www.youtube.com/watch?v=1' }).kind, 'video');
  assert.equal(classifyResource({ ...base, title: 'We propose a benchmark', url: 'https://arxiv.org/abs/1' }).kind, 'paper');
  assert.equal(classifyResource({ ...base, title: 'Quarterly earnings update' }), null);
});
