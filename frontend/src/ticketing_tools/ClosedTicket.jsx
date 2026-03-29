import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import TicketSearch from "../ticketing_tools/TicketSearch";
import TicketTable from "../ticketing_tools/TicketTable";
import styles from "../css/OpenedTicket.module.css";

import {
    getBranches,
    getTeams,
    getTicketTypes,
    searchClosedTickets
} from "../services/ticketService";

const ClosedTickets = () => {

    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user")); // or from context
    const role = user?.role;
    const [tickets, setTickets] = useState([]);
    const [branches, setBranches] = useState([]);
    const [teams, setTeams] = useState([]);
    const [ticketTypes, setTicketTypes] = useState([]);

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
        branch: "",
        assigned_team: "",
        type_of_ticket: "",
        subtype_of_ticket: ""
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {

        fetchTickets();

        const interval = setInterval(fetchTickets, 30000);

        return () => clearInterval(interval);

    }, [page, sortField, sortOrder, searchParams]);

    const loadInitialData = async () => {

        try {

            const [b, t, types] = await Promise.all([
                getBranches(),
                getTeams(),
                getTicketTypes()
            ]);

            setBranches(b.data);
            setTeams(t.data);
            setTicketTypes(types.data);

        } catch {
            toast.error("Failed loading data");
        }

    };

    const fetchTickets = async () => {

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

    return (

        <div className={styles.container}>

            <h1 className={styles.title}>Closed Tickets</h1>

            <TicketSearch
                branches={branches}
                teams={teams}
                ticketTypes={ticketTypes}
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                onSearch={fetchTickets}
            />

            <TicketTable
                tickets={tickets}
                teams={teams}
                refreshTickets={fetchTickets}
                onTicketClick={goToTicket}
                onSort={handleSort}
                role={role}
                isClosedPage={true}
            />

            <div className={styles.pagination}>

                <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                >
                    Prev
                </button>

                <select
                    value={page}
                    onChange={(e) => setPage(Number(e.target.value))}
                >
                    {Array.from({ length: totalPages }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                            Page {i + 1}
                        </option>
                    ))}
                </select>

                <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>

            </div>

        </div>

    );

};

export default ClosedTickets;