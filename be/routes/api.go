package routes

import (
	"projectrfqv1/app/controllers"
	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/controllers/rfq"

	"github.com/gorilla/mux"
)

func ApiRoutes(prefix string, r *mux.Router) {

	s := r.PathPrefix(prefix).Subrouter()

	s.HandleFunc("/login", auth.Login).Methods("POST")
	s.HandleFunc("/refresh", auth.Refresh).Methods("POST")
	s.HandleFunc("/logout", auth.Logout).Methods("POST")

	s.HandleFunc("/register", auth.Register).Methods("POST")

	s.HandleFunc(
		"/me",
		auth.ValidateMiddleware(controllers.GetMe),
	).Methods("GET")

	s.HandleFunc(
		"/me",
		auth.ValidateMiddleware(controllers.UpdateMe),
	).Methods("PUT")

	s.HandleFunc(
		"/users",
		auth.ValidateMiddleware(controllers.GetUsers),
	).Methods("GET")

	s.HandleFunc(
		"/users/{id:[0-9]+}",
		auth.ValidateMiddleware(controllers.GetUser),
	).Methods("GET")

	s.HandleFunc(
		"/users",
		auth.ValidateMiddleware(controllers.CreateUser),
	).Methods("POST")

	s.HandleFunc(
		"/users/{id:[0-9]+}",
		auth.ValidateMiddleware(controllers.UpdateUser),
	).Methods("PUT")

	s.HandleFunc(
		"/users/{id:[0-9]+}",
		auth.ValidateMiddleware(controllers.DeleteUser),
	).Methods("DELETE")

	s.HandleFunc(
		"/rfqs",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.CreateRFQ,
			),
		),
	).Methods("POST")

	s.HandleFunc(
		"/rfqs",
		auth.ValidateMiddleware(
			rfq.GetRFQList,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}",
		auth.ValidateMiddleware(
			rfq.GetRFQDetail,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/approve",
		auth.ValidateMiddleware(
			rfq.ApproveRFQ,
		),
	).Methods("PATCH", "POST")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.DeleteRFQ,
			),
		),
	).Methods("DELETE")

	s.HandleFunc(
		"/rfqs/products",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.UpdateRFQProduct,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/products",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.DeleteRFQProduct,
			),
		),
	).Methods("DELETE")

	// Main activity (status activity + timeline)
	s.HandleFunc(
		"/rfqs/mainactivity",
		auth.ValidateMiddleware(
			rfq.GetMainActivity,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/timeline",
		auth.ValidateMiddleware(
			rfq.GetTimeline,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/dashboard-activity",
		auth.ValidateMiddleware(
			rfq.DashboardMainActivityGetHandler,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/activity/move",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.MoveActivity,
			),
		),
	).Methods("POST")

	// Activity master data
	s.HandleFunc(
		"/rfq-activities",
		auth.ValidateMiddleware(
			rfq.ListActivityCodes,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfq-activities/engineering-template",
		auth.ValidateMiddleware(
			rfq.EngineeringActivityTemplateGetHandler,
		),
	).Methods("GET")

	// Standard Cost
	s.HandleFunc(
		"/standard-cost/master",
		auth.ValidateMiddleware(
			rfq.ListStandardCostMaster,
		),
	).Methods("GET")

	s.HandleFunc(
		"/standard-cost/master",
		auth.ValidateMiddleware(
			rfq.CreateStandardCostMaster,
		),
	).Methods("POST")

	s.HandleFunc(
		"/standard-cost/master/{id:[0-9]+}",
		auth.ValidateMiddleware(
			rfq.UpdateStandardCostMaster,
		),
	).Methods("PUT")

	s.HandleFunc(
		"/standard-cost/master/{id:[0-9]+}",
		auth.ValidateMiddleware(
			rfq.DeleteStandardCostMaster,
		),
	).Methods("DELETE")

	// Master RFQ Activity (CRUD) - marketing only
	s.HandleFunc(
		"/rfq-activities/master",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.MasterActivityList,
			),
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfq-activities/master",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.MasterActivityCreate,
			),
		),
	).Methods("POST")

	s.HandleFunc(
		"/rfq-activities/master/{id:[0-9]+}",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.MasterActivityUpdate,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfq-activities/master/{id:[0-9]+}",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionRFQCRUD)(
				rfq.MasterActivityDelete,
			),
		),
	).Methods("DELETE")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs",
		auth.ValidateMiddleware(
			rfq.GetPFSBundle,
		),
	).Methods("GET")

	s.HandleFunc(
		"/pfs/master/forging-processes",
		auth.ValidateMiddleware(
			rfq.ListMasterForgingProcesses,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/overview",
		auth.ValidateMiddleware(
			rfq.GetPFSOverview,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/overview",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.UpsertPFSOverview,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/process-plan",
		auth.ValidateMiddleware(
			rfq.GetPFSProcessPlan,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/process-plan",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.ReplacePFSProcessPlan,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/process-equipment",
		auth.ValidateMiddleware(
			rfq.GetPFSProcessEquipment,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/process-equipment",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.ReplacePFSProcessEquipment,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/technical-spec",
		auth.ValidateMiddleware(
			rfq.GetPFSTechnicalSpec,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/technical-spec",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.UpsertPFSTechnicalSpec,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/investments",
		auth.ValidateMiddleware(
			rfq.GetPFSInvestments,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/investments",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.ReplacePFSInvestments,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/investment-summary",
		auth.ValidateMiddleware(
			rfq.GetPFSInvestmentSummary,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/investment-summary",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.UpsertPFSInvestmentSummary,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/drawing",
		auth.ValidateMiddleware(
			rfq.GetPFSDrawings,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/drawing",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.UploadPFSDrawing,
			),
		),
	).Methods("POST")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/drawing/{file_id:[0-9]+}",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.DeletePFSDrawing,
			),
		),
	).Methods("DELETE")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/out-house-purchasing-attachments",
		auth.ValidateMiddleware(
			rfq.GetPFSOutHouseAttachments,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/out-house-purchasing-attachments",
		auth.ValidateMiddleware(
			rfq.UploadPFSOutHouseAttachment,
		),
	).Methods("POST")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/out-house-purchasing-attachments/{file_id:[0-9]+}",
		auth.ValidateMiddleware(
			rfq.DeletePFSOutHouseAttachment,
		),
	).Methods("DELETE")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/timeframe",
		auth.ValidateMiddleware(
			rfq.GetPFSTimeFrame,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/timeframe",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.UpsertPFSTimeFrame,
			),
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/standard-cost",
		auth.ValidateMiddleware(
			rfq.GetStandardCostDocument,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/standard-cost/investment-attachments",
		auth.ValidateMiddleware(
			rfq.GetStandardCostInvestmentAttachments,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/standard-cost/investment-attachments",
		auth.ValidateMiddleware(
			rfq.UploadStandardCostInvestmentAttachment,
		),
	).Methods("POST")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/standard-cost",
		auth.ValidateMiddleware(
			rfq.UpsertStandardCostDocument,
		),
	).Methods("PUT")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/feasibility",
		auth.ValidateMiddleware(
			auth.RequireRole("marketing")(rfq.GetFeasibility),
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/feasibility/summary",
		auth.ValidateMiddleware(
			auth.RequireRole("marketing")(rfq.GetFeasibilitySummary),
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/feasibility",
		auth.ValidateMiddleware(
			auth.RequireRole("marketing")(rfq.UpsertFeasibility),
		),
	).Methods("PUT")

	// Unified PFS Template endpoint: supports type param (jack, toolset, default=forging)
	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/template",
		auth.ValidateMiddleware(
			rfq.GetPFSTemplate,
		),
	).Methods("GET")

	s.HandleFunc(
		"/rfqs/{id:[0-9]+}/pfs/template",
		auth.ValidateMiddleware(
			auth.RequirePermission(auth.PermissionPFSCRUD)(
				rfq.UpsertPFSTemplate,
			),
		),
	).Methods("PUT")
}
