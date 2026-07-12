import unittest
from pathlib import Path

from data.xlsx2json import build_leaderboard_json, rank_sum


ROOT = Path(__file__).resolve().parents[1]
BENCHMARK = ROOT / "data" / "benchmark.xlsx"


class LeaderboardDataTest(unittest.TestCase):
    def test_builds_categories_from_workbook_sheets(self):
        payload = build_leaderboard_json(BENCHMARK)
        task = payload["tasks"][0]

        self.assertEqual(
            [category["id"] for category in task["categories"]],
            ["all", "cnn", "transformer"],
        )

        all_category = task["categories"][0]
        self.assertEqual([dataset["id"] for dataset in all_category["datasets"]], ["camo", "cod10k", "nc4k"])
        self.assertEqual(
            all_category["metrics"],
            ["MAE", "WeightedFmeasure", "Smeasure", "Emeasure", "ContextMeasure"],
        )
        self.assertEqual(all_category["higherIsBetter"]["MAE"], False)
        self.assertEqual(all_category["higherIsBetter"]["ContextMeasure"], True)
        self.assertEqual(len(all_category["models"]), 40)

    def test_preserves_model_metadata_and_nested_results(self):
        payload = build_leaderboard_json(BENCHMARK)
        all_category = payload["tasks"][0]["categories"][0]
        depth_sam = next(model for model in all_category["models"] if model["name"] == "DepthSAM")

        self.assertEqual(depth_sam["pubYear"], "CVPR 26")
        self.assertEqual(depth_sam["size"], "512 x 512")
        self.assertEqual(depth_sam["backbone"], "DAv2 ViT-L")
        self.assertAlmostEqual(depth_sam["results"]["nc4k"]["ContextMeasure"], 0.889515)

    def test_context_measure_rank_sum_orders_default_matrix(self):
        payload = build_leaderboard_json(BENCHMARK)
        all_category = payload["tasks"][0]["categories"][0]

        ranked = rank_sum(all_category["models"], ["camo", "cod10k", "nc4k"], "ContextMeasure", all_category["higherIsBetter"])

        self.assertEqual(ranked[0]["name"], "DepthSAM")
        self.assertEqual(ranked[0]["rankSum"], 3)

    def test_mae_rank_sum_treats_lower_values_as_better(self):
        payload = build_leaderboard_json(BENCHMARK)
        all_category = payload["tasks"][0]["categories"][0]

        ranked = rank_sum(all_category["models"], ["camo", "cod10k", "nc4k"], "MAE", all_category["higherIsBetter"])

        self.assertEqual(ranked[0]["name"], "DepthSAM")
        self.assertEqual(ranked[0]["rankSum"], 3)


if __name__ == "__main__":
    unittest.main()
