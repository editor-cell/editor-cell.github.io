"""Safety checks for dataset separation and checkpoint continuation; never model training data."""
import copy
import unittest

from independent_exam_data import overlap_audit
from qwen_paragraph_round import digest, prompt, validate


def question(qid, passage, group='English reading'):
    return {'id': qid, 'passage': passage, 'group': group, 'question': 'Which option?',
            'options': ['first', 'second', 'third', 'fourth', 'fifth'], 'answer': 'C'}


class DataBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.train = [question('train', 'training passage')]
        self.dev = [question('dev', 'development passage')]
        self.questions = [question(str(i), 'exam passage '+str(i)) for i in range(97)]
        self.exam = {'run_id': 'test', 'questions': self.questions, 'fingerprint': digest(self.questions)}
        self.profile = {'run_id': 'test', 'train': self.train, 'dev': self.dev,
            'train_fingerprint': digest(self.train), 'dev_fingerprint': digest(self.dev),
            'exam_fingerprint': digest(self.questions), 'request': {'minutes': 15},
            'state': {'base_repo': 'Qwen/Qwen3-4B', 'round': 0, 'adapter_repo': None}}

    def test_disjoint_data_is_accepted(self):
        validate(self.profile, self.exam)

    def test_same_exam_passage_is_rejected_even_with_another_id(self):
        self.profile['train'][0]['passage'] = self.questions[0]['passage']
        self.profile['train_fingerprint'] = digest(self.profile['train'])
        with self.assertRaisesRegex(ValueError, 'overlaps'):
            validate(self.profile, self.exam)

    def test_modified_exam_answer_is_rejected(self):
        self.exam['questions'][0]['answer'] = 'D'
        with self.assertRaisesRegex(ValueError, 'Wrong examination'):
            validate(self.profile, self.exam)

    def test_no_original_fallback_after_round_one(self):
        self.profile['state']['round'] = 1
        with self.assertRaisesRegex(ValueError, 'fallback'):
            validate(self.profile, self.exam)

    def test_nonreading_training_is_rejected(self):
        self.profile['train'][0]['group'] = 'Logical reasoning'
        self.profile['train_fingerprint'] = digest(self.profile['train'])
        with self.assertRaisesRegex(ValueError, 'Only English'):
            validate(self.profile, self.exam)

    def test_near_duplicate_passage_is_removed(self):
        words = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen'
        rows = [question('overlap', words), question('clean', 'a separate text with entirely unrelated vocabulary')]
        kept, audit = overlap_audit(rows, ['prefix ' + words + ' suffix'])
        self.assertEqual([q['id'] for q in kept], ['clean'])
        self.assertIn('overlap', audit['excluded'])

    def test_permutation_preserves_options_and_maps_answer(self):
        q = self.train[0]
        order = [4, 2, 0, 1, 3]
        rendered = prompt(q, order)
        self.assertIn('A) fifth\nB) third\nC) first\nD) second\nE) fourth', rendered)
        self.assertEqual(order.index('ABCDE'.index(q['answer'])), 1)
        self.assertEqual(q['answer'], 'C')

    def test_default_prompt_matches_baseline(self):
        q = self.train[0]
        expected = ('Read the passage and answer the question. Reply with the letter of the correct option only.\n\n'
                    'Passage:\ntraining passage\n\nQuestion: Which option?\n\n'
                    'A) first\nB) second\nC) third\nD) fourth\nE) fifth\n\nAnswer:')
        self.assertEqual(prompt(q), expected)


if __name__ == '__main__':
    unittest.main()
