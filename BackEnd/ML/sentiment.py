import json
import sys

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

text = sys.argv[1] if len(sys.argv) > 1 else ""

analyzer = SentimentIntensityAnalyzer()
scores = analyzer.polarity_scores(text)

print(json.dumps(scores))
