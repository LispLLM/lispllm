"""Download Tiny Shakespeare from the canonical karpathy/char-rnn raw URL."""

import os
import urllib.request

URL = "https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt"
OUT = os.path.join(os.path.dirname(__file__), "data", "input.txt")


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        print(f"already have {OUT} ({os.path.getsize(OUT)} bytes)")
        return
    print(f"downloading {URL}")
    urllib.request.urlretrieve(URL, OUT)
    print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
