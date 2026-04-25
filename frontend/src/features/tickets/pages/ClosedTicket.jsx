import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import TicketSearch from "../components/TicketSearch";
import TicketTable from "../components/TicketTable";
import styles from "../../../css/tickets/OpenedTicket.module.css";
import { getZones } from "../../../services/employeeService";

import {
  getBranches,
  getTeams,
  getSubtypes,
  getTicketTypes,
  searchClosedTickets,
  exportClosedTickets
} from "../../../services/ticketService";
import { getAuthUser } from "../../../utils/auth";

const ClosedTickets = () => {
  const navigate = useNavigate();
  const user = getAuthUser();
  const role = user?.role;
  const designation = String(user?.designation_name || user?.designation || "").trim().toUpperCase();
  const team = String(user?.team_name || user?.team || "").trim().toUpperCase();

  const isClosedTicketApprover =
    ["ADMIN", "SUPER_ADMIN"].includes(String(role || "").trim().toUpperCase()) ||
    ["MD", "CEO", "CTO", "CMO", "SALES HEAD", "ASM", "TECH LEAD", "ASST TECH LEAD", "MANAGER", "ASST MANAGER", "ASSISTANT MANAGER"].includes(designation) ||
    (team === "SALES" && ["CMO", "SALES HEAD", "ASM"].includes(designation));

  const [tickets, setTickets] = useState([]);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchParams, setSearchParams] = useState({
    ticket_no: "",
    from_date: "",
    to_date: "",
    name: "",
    customer_id: "",
    customer_name: "",
    zone: "",
    branch: "",
    assigned_team: "",
    type_of_ticket: "",
    subtype_of_ticket: ""
  });

  const loadInitialData = useCallback(async () => {
    try {
      const [zoneRes, branchRes, teamRes, typesRes] = await Promise.all([
        getZones(),
        getBranches(),
        getTeams(),
        getTicketTypes()
      ]);

      setZones(zoneRes.data || []);
      setBranches(branchRes.data);
      setTeams(teamRes.data);
      setTicketTypes(typesRes.data);
    } catch {
      toast.error("Failed loading data");
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await searchClosedTickets({
        ...searchParams,
        page,
        limit,
        sortField,
        sortOrder
      });

      setTickets(res.data.tickets || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      toast.error("Failed to fetch closed tickets");
    }
  }, [limit, page, searchParams, sortField, sortOrder]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const runFetchTickets = async () => {
      try {
        const res = await searchClosedTickets({
          ...searchParams,
          page,
          limit,
          sortField,
          sortOrder
        });

        setTickets(res.data.tickets || []);
        setTotalPages(res.data.totalPages || 1);
      } catch {
        toast.error("Failed to fetch closed tickets");
      }
    };

    runFetchTickets();
    const interval = setInterval(runFetchTickets, 30000);
    return () => clearInterval(interval);
  }, [limit, page, searchParams, sortField, sortOrder]);

  useEffect(() => {
    const loadSubtypes = async () => {
      if (!searchParams.type_of_ticket) {
        setSubtypes([]);
        return;
      }

      try {
        const res = await getSubtypes(searchParams.type_of_ticket);
        setSubtypes(res.data || []);
      } catch {
        toast.error("Failed to load ticket subtypes");
        setSubtypes([]);
      }
    };

    loadSubtypes();
  }, [searchParams.type_of_ticket]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const goToTicket = (id) => {
    navigate(`/tickets/history/${id}`);
  };

  const handleResetFilters = () => {
    setSearchParams({
      ticket_no: "",
      from_date: "",
      to_date: "",
      name: "",
      customer_id: "",
      customer_name: "",
      zone: "",
      branch: "",
      assigned_team: "",
      type_of_ticket: "",
      subtype_of_ticket: ""
    });
    setSubtypes([]);
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const res = await exportClosedTickets({
        ...searchParams,
        sortField,
        sortOrder
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `closed-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export closed tickets");
    }
  };

  const filteredBranches = searchParams.zone
    ? branches.filter((branch) => String(branch.zone_id) === String(searchParams.zone))
    : branches;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Closed Tickets</h1>

      <TicketSearch
        zones={zones}
        branches={filteredBranches}
        teams={teams}
        ticketTypes={ticketTypes}
        subtypes={subtypes}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        onExport={handleExport}
        onReset={handleResetFilters}
      />

      <TicketTable
        tickets={tickets}
        teams={teams}
        refreshTickets={fetchTickets}
        onTicketClick={goToTicket}
        onSort={handleSort}
        role={role}
        isClosedPage
        showActionsColumn={isClosedTicketApprover}
      />

      <div className={styles.pagination}>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Prev
        </button>

        <select value={page} onChange={(e) => setPage(Number(e.target.value))}>
          {Array.from({ length: totalPages }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              Page {index + 1}
            </option>
          ))}
        </select>

        <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
};

export default ClosedTickets;
