"""Fresh synthetic paragraphs: exercise the deployed endpoint, not medical claims."""
import concurrent.futures
import json
import time
import urllib.request
from pathlib import Path

BASE = 'https://orbis-deepseek-trial.editor-aa8.workers.dev'
CASES = [
    ('bare-country-heading', 'obezitenin en çok görüldüğü ülkeler', 'Situation épidémiologique - Cameroun', 'UNRELATED', 'topic'),
    ('obesity-ranking', 'obezitenin en çok görüldüğü ülkeler', 'In this fictional survey of five countries, obesity prevalence was highest in Country A at 38%, followed by Country B at 31%. Country C had the lowest prevalence at 12%.', 'SUPPORTS', 'topic'),
    ('risk-support', 'Obezite kalp krizi ihtimalini artırır.', 'In this fictional cohort, people with obesity had a higher risk of myocardial infarction than people of normal weight, even after adjustment for age.', 'SUPPORTS', 'claim'),
    ('risk-opposite', 'Obezite kalp krizi ihtimalini artırır.', 'This fictional study found no increase in myocardial infarction risk among participants with obesity compared with participants of normal weight.', 'CONTRADICTS', 'claim'),
    ('topic-only', 'Obezite kalp krizi ihtimalini artırır.', 'The fictional report describes childhood obesity prevalence by region. It contains no cardiovascular outcome data.', 'UNRELATED', 'claim'),
    ('turkish-question', 'Obezite ne demektir?', 'Obezite, sağlığı bozabilecek ölçüde aşırı veya anormal yağ birikmesidir.', 'SUPPORTS', 'topic'),
]

def run(case):
    name, query, paragraph, expected, kind = case
    start = time.monotonic()
    body = json.dumps({'query': query, 'paragraph': paragraph}).encode()
    req = urllib.request.Request(BASE + '/judge', data=body, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=150) as response:
            data = json.load(response)
        ok = data.get('verdict') == expected and data.get('query_kind') == kind and data.get('version') == 'deepseek-r1-32b-v1'
        return {'name': name, 'expected': expected, 'response': data, 'passed': ok, 'seconds': round(time.monotonic() - start, 2)}
    except Exception as error:
        return {'name': name, 'passed': False, 'error': str(error)}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(run, CASES))
    Path(__file__).with_name('smoke-result.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    for result in results:
        print(json.dumps(result, ensure_ascii=False), flush=True)
    assert all(r['passed'] for r in results), 'Deployed DeepSeek smoke checks failed'
