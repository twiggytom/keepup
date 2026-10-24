from datetime import date

import pytest

from app.models import Sex
from app.norms import age_on, cdc_norm


@pytest.mark.parametrize(
    "age,sex,threshold,band",
    [
        (60, Sex.male, 14, "60-64"),
        (64, Sex.male, 14, "60-64"),
        (65, Sex.male, 12, "65-69"),
        (74, Sex.female, 10, "70-74"),
        (89, Sex.female, 8, "85-89"),
        (94, Sex.female, 4, "90-94"),
    ],
)
def test_band_edges(age, sex, threshold, band):
    n = cdc_norm(age, sex)
    assert (n.threshold, n.band, n.applicable) == (threshold, band, True)


def test_out_of_range_not_applicable():
    assert cdc_norm(55, Sex.male).applicable is False
    assert cdc_norm(97, Sex.female).band == "90-94"


def test_age_on_birthday_boundary():
    bd = date(1950, 6, 15)
    assert age_on(bd, date(2025, 6, 14)) == 74
    assert age_on(bd, date(2025, 6, 15)) == 75
