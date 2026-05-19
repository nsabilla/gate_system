package auth

import "testing"

func TestBuildPermissions_MarketingPreparedCanCRUDRFQ(t *testing.T) {
	perms := BuildPermissions("marketing", "prepared")

	if !perms[PermissionRFQCRUD] {
		t.Fatalf("expected marketing+prepared to have %s", PermissionRFQCRUD)
	}
	if perms[PermissionRFQApprove] {
		t.Fatalf("expected marketing+prepared to not have %s", PermissionRFQApprove)
	}
}

func TestBuildPermissions_MarketingApproveCanApproveRFQ(t *testing.T) {
	perms := BuildPermissions("marketing", "approve")

	if !perms[PermissionRFQApprove] {
		t.Fatalf("expected marketing+approve to have %s", PermissionRFQApprove)
	}
	if perms[PermissionRFQCRUD] {
		t.Fatalf("expected marketing+approve to not have %s", PermissionRFQCRUD)
	}
}
