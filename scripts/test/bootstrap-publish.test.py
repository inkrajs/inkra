import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "bootstrap", Path(__file__).parents[1] / "bootstrap-publish.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class BootstrapTests(unittest.TestCase):
    def test_official_url_only(self):
        self.assertIsNone(MODULE.AUTH_URL.search("https://example.com/auth/cli/test"))
        self.assertEqual(MODULE.AUTH_URL.search(
            "Authenticate at https://www.npmjs.com/auth/cli/test-id\r\n"
        ).group(0), "https://www.npmjs.com/auth/cli/test-id")

    def test_pty_success_and_redaction(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            (root / "session").mkdir()
            (root / "scripts/release.mjs").write_text(
                "if (!process.stdin.isTTY || !process.stdout.isTTY) process.exit(9);"
                "console.log(process.env.NODE_AUTH_TOKEN);"
                "console.log('https://www.npmjs.com/auth/cli/test-id');"
            )
            previous = os.environ.get("NODE_AUTH_TOKEN")
            os.environ["NODE_AUTH_TOKEN"] = "fake-test-credential"
            try:
                MODULE.worker(root / "session", root, ["node", "scripts/release.mjs"])
            finally:
                if previous is None:
                    del os.environ["NODE_AUTH_TOKEN"]
                else:
                    os.environ["NODE_AUTH_TOKEN"] = previous
            self.assertEqual(json.loads((root / "session/result.json").read_text())["code"], 0)
            self.assertNotIn("fake-test-credential", (root / "session/output.txt").read_text())
            self.assertTrue((root / "session/approval.txt").exists())

    def test_nonzero_exit_is_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            (root / "session").mkdir()
            (root / "scripts/release.mjs").write_text("process.exit(7)")
            MODULE.worker(root / "session", root, ["node", "scripts/release.mjs"])
            self.assertEqual(json.loads((root / "session/result.json").read_text())["code"], 7)


if __name__ == "__main__":
    unittest.main()
