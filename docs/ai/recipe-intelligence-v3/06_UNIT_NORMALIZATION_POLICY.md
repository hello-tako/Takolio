# Unit normalization policy

V3 stores both the source display quantity and any runtime projection.

Universal conversions are allowed only within a compatible mass or volume
dimension. Contextual units such as piece, bunch, slice, bowl, clove, package,
and fruit require ingredient-specific evidence. Estimates remain estimates.

Every conversion records:

- original text and unit;
- normalized amount/unit, if any;
- conversion basis and evidence;
- whether the amount is purchase, process, or edible quantity;
- whether shopping, cooking, and nutrition may consume it.

Qualitative amounts remain qualitative and runtime-null. Deep-frying oil,
blanching salt, wash water, soaking water, discarded aromatics, and garnish
must not be counted as edible or purchased demand without explicit policy.

The runtime unit set remains `g`, `kg`, `ml`, `l`, `piece`, `pack`,
`bunch`, and `slice`. This is a projection constraint, not permission to
erase the source unit.
