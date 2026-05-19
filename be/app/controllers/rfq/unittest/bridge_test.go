package rfq

import base "projectrfqv1/app/controllers/rfq"

var (
	ListActivityCodes               = base.ListActivityCodes
	ApproveRFQ                      = base.ApproveRFQ
	DashboardMainActivityGetHandler = base.DashboardMainActivityGetHandler
	DeleteRFQ                       = base.DeleteRFQ
	GetRFQList                      = base.GetRFQList
	GetMainActivity                 = base.GetMainActivity
	GetTimeline                     = base.GetTimeline
	MoveActivity                    = base.MoveActivity
	MasterActivityList              = base.MasterActivityList
	MasterActivityCreate            = base.MasterActivityCreate
	MasterActivityUpdate            = base.MasterActivityUpdate
	MasterActivityDelete            = base.MasterActivityDelete
	GetPFSBundle                    = base.GetPFSBundle
	GetPFSTemplate                  = base.GetPFSTemplate
	UpsertPFSOverview               = base.UpsertPFSOverview
	ReplacePFSProcessPlan           = base.ReplacePFSProcessPlan
	UpsertPFSTimeFrame              = base.UpsertPFSTimeFrame
	GetRFQDetail                    = base.GetRFQDetail
	UpdateRFQProduct                = base.UpdateRFQProduct
	DeleteRFQProduct                = base.DeleteRFQProduct
	CreateRFQ                       = base.CreateRFQ
)
