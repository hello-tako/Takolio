# Runtime compatibility

V1 remains the only runtime authority in this checkpoint.

The V2 release compiler correctly blocks when projection loses source lines,
ingredient identities are provisional, source content is unverified, or
nutrition evidence is incomplete. The V3 audit mirrors these conditions and
never changes them to make a check green.

Compatibility rules:

- preserve all 500 IDs and existing slugs;
- preserve V1 fingerprint until a separately approved release;
- do not change runtime units or silently coerce contextual units;
- do not feed candidate quantities to inventory deduction;
- do not change API response shape;
- do not promote candidate media or nutrition;
- retain a prior release for rollback.

The only allowed current consumer of V3 artifacts is review and audit tooling.
